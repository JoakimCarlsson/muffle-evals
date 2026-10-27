import { $ZodLazy, type $ZodType } from "./schemas.js";
import * as util from "./util.js";

/**
 * Internal schema traversal shared by `deepPartial`, `z.input()` and `z.output()`.
 * Not exported from any public barrel.
 */

/** A callback run on every node, or a handler map keyed by `schema._zod.def.type`. */
export type Rewrite =
  | ((schema: $ZodType) => $ZodType)
  | Record<string, ((schema: any) => $ZodType) | undefined>;

/** A child that is part of a cycle still being visited: its rewritten form isn't known yet. */
class Ref {
  constructor(readonly ref: $ZodType) {}
}
type Child = $ZodType | Ref;
type Visit = (child: $ZodType) => Child;
type Solid = (child: Child) => $ZodType;

/** Rewrites the children of one def kind and returns the def fields that changed. */
type Rebuild = (
  def: any,
  visit: Visit,
  solid: Solid,
) => Record<string, unknown>;

const inner: Rebuild = (def, visit, solid) => ({
  innerType: solid(visit(def.innerType)),
});
const options: Rebuild = (def, visit, solid) => ({
  options: def.options.map((o: $ZodType) => solid(visit(o))),
});
const keyValue: Rebuild = (def, visit, solid) => ({
  keyType: solid(visit(def.keyType)),
  valueType: solid(visit(def.valueType)),
});

const rebuilders: Record<string, Rebuild> = {
  object: (def, visit, solid) => {
    const shape: Record<string, $ZodType> = {};
    for (const key of Object.keys(def.shape))
      util.assignProp(shape, key, solid(visit(def.shape[key])));
    return def.catchall
      ? { shape, catchall: solid(visit(def.catchall)) }
      : { shape };
  },
  array: (def, visit, solid) => ({ element: solid(visit(def.element)) }),
  tuple: (def, visit, solid) => ({
    items: def.items.map((i: $ZodType) => solid(visit(i))),
    rest: def.rest ? solid(visit(def.rest)) : def.rest,
  }),
  record: keyValue,
  map: keyValue,
  set: (def, visit, solid) => ({ valueType: solid(visit(def.valueType)) }),
  // a discriminated union is a "union" def with a discriminator
  union: options,
  intersection: (def, visit, solid) => ({
    left: solid(visit(def.left)),
    right: solid(visit(def.right)),
  }),
  optional: inner,
  nullable: inner,
  default: inner,
  prefault: inner,
  nonoptional: inner,
  catch: inner,
  readonly: inner,
  promise: inner,
  success: inner,
  // covers codec and preprocess too: they are pipes, and cloning keeps their class
  pipe: (def, visit, solid) => ({
    in: solid(visit(def.in)),
    out: solid(visit(def.out)),
  }),
  function: (def, visit, solid) => ({
    input: def.input ? solid(visit(def.input)) : def.input,
    output: def.output ? solid(visit(def.output)) : def.output,
  }),
};

const DEFERRED = Symbol("deferred");

interface Member {
  out: $ZodType;
  changed: boolean;
}

/**
 * Rewrites `schema` bottom-up and returns the new schema.
 *
 * Children are rewritten first and the parent is re-cloned only if a child changed, so an untouched
 * schema comes back as the same object. Every unique node is visited once.
 *
 * Cycles (`z.lazy` recursion, getter-based recursive objects) are handled as strongly connected
 * components: the nodes of a cycle see each other through lazy forwarders while they are being
 * rewritten, and the whole component is kept or replaced at once when its root finishes. Nothing
 * runs at parse time.
 */
export function visit(schema: $ZodType, rewrite: Rewrite): $ZodType {
  const apply =
    typeof rewrite === "function"
      ? rewrite
      : (s: $ZodType) => {
          const handler = rewrite[s._zod.def.type];
          return handler ? handler(s) : s;
        };

  // final results; a node is only in here once its whole cycle is closed
  const memo = new Map<$ZodType, $ZodType>();
  // Tarjan bookkeeping for nodes of cycles that are still open
  const index = new Map<$ZodType, number>();
  const low = new Map<$ZodType, number>();
  const open = new Set<$ZodType>();
  const stack: $ZodType[] = [];
  const members = new Map<$ZodType, Member>();
  const forwarders = new Map<$ZodType, $ZodType>();

  // Stands in for a node of an open cycle until its result exists.
  const forwarder = (node: $ZodType): $ZodType => {
    let fwd = forwarders.get(node);
    if (!fwd) {
      fwd = new ($ZodLazy as any)({
        type: "lazy",
        getter: () => memo.get(node) ?? node,
      }) as $ZodType;
      forwarders.set(node, fwd);
    }
    return fwd;
  };
  const solid: Solid = (child) =>
    child instanceof Ref ? forwarder(child.ref) : child;

  const go = (node: $ZodType): $ZodType | typeof DEFERRED => {
    const done = memo.get(node);
    if (done) return done;
    if (open.has(node)) return DEFERRED;

    const id = index.size;
    index.set(node, id);
    low.set(node, id);
    open.add(node);
    stack.push(node);

    const def: any = node._zod.def;
    let changed = false;
    let deferred = false;
    const visitChild: Visit = (child) => {
      const res = go(child);
      if (res === DEFERRED) {
        deferred = true;
        low.set(node, Math.min(low.get(node)!, low.get(child)!));
        return new Ref(child);
      }
      if (res !== child) changed = true;
      return res;
    };

    let patch: Record<string, unknown> | undefined;
    if (def.type === "lazy") {
      // `innerType` resolves (and caches) the getter, so an already resolved lazy is covered too
      const res = visitChild((node as any)._zod.innerType);
      // `_cachedInner` would otherwise be copied over from the original def
      patch = {
        getter: () =>
          res instanceof Ref ? (memo.get(res.ref) ?? res.ref) : res,
        _cachedInner: undefined,
      };
    } else if (Object.prototype.hasOwnProperty.call(rebuilders, def.type)) {
      patch = rebuilders[def.type]!(def, visitChild, solid);
    }

    // Inside a cycle the clone is always made, so that it points at forwarders rather than at
    // originals; it is thrown away again if the cycle turns out to be unchanged.
    const input =
      patch && (changed || deferred)
        ? util.clone(node, { ...def, ...patch }, { parent: true })
        : node;
    const out = apply(input);

    if (low.get(node) !== id) {
      members.set(node, { out, changed: changed || out !== input });
      return DEFERRED;
    }

    // `node` is the root of its cycle (or a node of no cycle): close it
    const group: $ZodType[] = [];
    let member: $ZodType;
    do {
      member = stack.pop()!;
      open.delete(member);
      group.push(member);
    } while (member !== node);
    members.set(node, { out, changed: changed || out !== input });
    const rewritten = group.some((m) => members.get(m)!.changed);
    for (const m of group) memo.set(m, rewritten ? members.get(m)!.out : m);
    return memo.get(node)!;
  };

  return go(schema) as $ZodType;
}
