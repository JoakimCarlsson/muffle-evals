import type * as schemas from "./schemas.js";
import { clone } from "./util.js";

/** A rewrite step: a callback run on every node, or handlers keyed by `def.type`. */
export type Rewrite = ((schema: schemas.$ZodType) => schemas.$ZodType) | { [type: string]: ((schema: any) => schemas.$ZodType) | undefined };

const LEAF_TYPES = new Set([
  "any",
  "bigint",
  "boolean",
  "custom",
  "date",
  "enum",
  "file",
  "literal",
  "nan",
  "never",
  "null",
  "number",
  "string",
  "symbol",
  "template_literal",
  "transform",
  "undefined",
  "unknown",
  "void",
]);

const INNER_TYPES = new Set([
  "optional",
  "nullable",
  "default",
  "prefault",
  "nonoptional",
  "catch",
  "readonly",
  "promise",
  "success",
]);

type Frame = { open: Set<schemas.$ZodType>; changed: boolean };

/**
 * Returns `def` with `f` applied to every child schema, or `def` itself when no child changed.
 * Lazy defs get a fresh `getter` and an overwritten `_cachedInner` so a stale resolved inner is never reused.
 */
function mapDef(def: any, f: (child: schemas.$ZodType) => schemas.$ZodType): any {
  let changed = false;
  const m = <T extends schemas.$ZodType | undefined>(c: T): T => {
    if (!c) return c;
    const n = f(c) as T;
    if (n !== c) changed = true;
    return n;
  };
  const mAll = (cs: readonly schemas.$ZodType[]) => cs.map((c) => m(c));
  let patch: any;
  const type: string = def.type;
  if (type === "object") {
    const shape: any = {};
    for (const k of Object.keys(def.shape)) shape[k] = m(def.shape[k]);
    patch = { shape, catchall: m(def.catchall) };
  } else if (type === "array") patch = { element: m(def.element) };
  else if (type === "tuple") patch = { items: mAll(def.items), rest: m(def.rest) };
  else if (type === "record" || type === "map") patch = { keyType: m(def.keyType), valueType: m(def.valueType) };
  else if (type === "set") patch = { valueType: m(def.valueType) };
  else if (type === "union") patch = { options: mAll(def.options) };
  else if (type === "intersection") patch = { left: m(def.left), right: m(def.right) };
  else if (INNER_TYPES.has(type)) patch = { innerType: m(def.innerType) };
  else if (type === "pipe") patch = { in: m(def.in), out: m(def.out) };
  else if (type === "function") patch = { input: m(def.input), output: m(def.output) };
  else if (type === "lazy") {
    const inner = m(def._cachedInner);
    if (!changed) return def;
    const next: any = { ...def, _cachedInner: inner };
    next.getter = () => next._cachedInner;
    return next;
  } else return def;
  if (!changed) return def;
  for (const k in patch) if (patch[k] === undefined && !(k in def)) delete patch[k];
  return { ...def, ...patch };
}

/**
 * Rewrites a schema bottom-up. Children are rewritten first and a parent is re-cloned only when a child changed,
 * so an untouched schema is returned as the same object. Each unique node is visited once; cycles terminate and
 * back edges are re-linked to the rewritten node. Nodes with an unknown `def.type` are returned untouched.
 *
 * @param schema - The schema to rewrite.
 * @param rewrite - A callback run on every node, or handlers keyed by `schema._zod.def.type`.
 * @returns The rewritten schema.
 */
export function visit(schema: schemas.$ZodType, rewrite: Rewrite): schemas.$ZodType {
  const apply =
    typeof rewrite === "function"
      ? rewrite
      : (s: schemas.$ZodType) => rewrite[s._zod.def.type]?.(s) ?? s;
  const memo = new Map<schemas.$ZodType, schemas.$ZodType>();
  const info = new Map<schemas.$ZodType, Frame>();
  const active = new Set<schemas.$ZodType>();
  const stack: Frame[] = [];
  const pending: Array<{ orig: schemas.$ZodType; built: schemas.$ZodType }> = [];

  const go = (node: schemas.$ZodType): schemas.$ZodType => {
    const parent = stack[stack.length - 1];
    if (memo.has(node)) {
      const done = info.get(node)!;
      if (parent) {
        parent.changed ||= done.changed;
        for (const o of done.open) if (active.has(o)) parent.open.add(o);
      }
      return memo.get(node)!;
    }
    if (active.has(node)) {
      parent!.open.add(node);
      return node;
    }
    const type = node._zod.def.type;
    if (!LEAF_TYPES.has(type) && !isContainer(type)) return node;

    const frame: Frame = { open: new Set(), changed: false };
    const start = pending.length;
    active.add(node);
    stack.push(frame);
    const def = node._zod.def as any;
    if (type === "lazy") void (node as schemas.$ZodLazy)._zod.innerType;
    let next = mapDef(def, go);
    stack.pop();

    const forced = frame.open.size > 0;
    if (forced && next === def) {
      next = { ...def };
      if (type === "lazy") next.getter = () => next._cachedInner;
    }
    const built = next !== def ? clone(node, next) : node;
    const result = apply(built);
    active.delete(node);
    frame.open.delete(node);
    frame.changed ||= result !== built;
    if (built !== node) pending.push({ orig: node, built });
    memo.set(node, result);
    info.set(node, frame);

    if (frame.open.size === 0) {
      const window = pending.splice(start);
      if (!frame.changed) {
        for (const w of window) memo.set(w.orig, w.orig);
      } else {
        const origs = new Map(window.map((w) => [w.orig, w.orig]));
        const resolve = (c: schemas.$ZodType) => (origs.has(c) ? memo.get(c)! : c);
        for (const w of window) {
          const relinked = mapDef(w.built._zod.def, resolve);
          if (relinked !== w.built._zod.def) Object.assign(w.built._zod.def, relinked);
        }
      }
    }
    if (parent) {
      parent.changed ||= frame.changed;
      for (const o of frame.open) parent.open.add(o);
    }
    return memo.get(node)!;
  };

  return go(schema);
}

function isContainer(type: string): boolean {
  return (
    INNER_TYPES.has(type) ||
    type === "object" ||
    type === "array" ||
    type === "tuple" ||
    type === "record" ||
    type === "map" ||
    type === "set" ||
    type === "union" ||
    type === "intersection" ||
    type === "pipe" ||
    type === "function" ||
    type === "lazy"
  );
}
