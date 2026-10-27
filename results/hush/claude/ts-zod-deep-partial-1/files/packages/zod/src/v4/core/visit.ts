import { $ZodLazy, type $ZodType, type $ZodTypeDef } from "./schemas.js";
import { clone, mergeDefs } from "./util.js";

/** A rewrite is a callback run on every node, or handlers keyed by `def.type`. */
export type Rewrite =
  | ((schema: $ZodType) => $ZodType)
  | { [K in $ZodTypeDef["type"]]?: ((schema: $ZodType) => $ZodType) | undefined };

interface Entry {
  res: $ZodType;
  /** A node was really rewritten in this subtree (not merely re-pointed at a cycle stub). */
  real: boolean;
  /** Cycle targets referenced through stubs in this subtree, other than the node itself. */
  taint: Set<$ZodType>;
}

interface Frame {
  stub?: $ZodType;
  start: number;
}

type LazyClass = new (def: any) => $ZodType;

/**
 * Rewrite a schema bottom-up. Children are rewritten first and the parent is re-cloned only
 * if a child changed, so untouched schemas keep their identity. Each unique node is visited
 * once. Cycles (`lazy`, getter-based objects) are closed through forwarding lazies, so the
 * rewrite never runs at parse time.
 *
 * @internal
 */
export function visit(schema: $ZodType, rewrite: Rewrite, Lazy: LazyClass = $ZodLazy as any): $ZodType {
  const done = new Map<$ZodType, Entry>();
  const active = new Map<$ZodType, Frame>();
  /** Finished nodes, in completion order. */
  const order: $ZodType[] = [];
  /** Cycle targets whose final result is the original node. */
  const same = new Set<$ZodType>();

  const apply = (node: $ZodType): $ZodType => {
    if (typeof rewrite === "function") return rewrite(node);
    return (rewrite as any)[node._zod.def.type]?.(node) ?? node;
  };

  const makeStub = (node: $ZodType): $ZodType => {
    const resolve = () => done.get(node)?.res ?? node;
    const stub = new Lazy({ type: "lazy", getter: resolve });
    // Not self-caching: the target may still be unresolved if this is read mid-visit.
    Object.defineProperty(stub._zod, "innerType", { get: resolve, configurable: true });
    return stub;
  };

  function walk(node: $ZodType): Entry {
    const hit = done.get(node);
    if (hit) return hit;

    const open = active.get(node);
    if (open) {
      open.stub ??= makeStub(node);
      return { res: open.stub, real: false, taint: new Set([node]) };
    }

    const frame: Frame = { start: order.length };
    active.set(node, frame);

    let real = false;
    const taint = new Set<$ZodType>();
    const sub = (child: $ZodType): $ZodType => {
      const e = walk(child);
      if (e.real) real = true;
      for (const t of e.taint) taint.add(t);
      return e.res;
    };

    const built = rebuild(node, sub);
    const out = apply(built);
    if (out !== built) real = true;
    taint.delete(node);

    active.delete(node);
    const entry: Entry = { res: out, real, taint };
    done.set(node, entry);
    order.push(node);

    // Nothing in the subtree really changed: nodes only re-cloned to point at stubs go back
    // to the originals once every cycle they hang off resolves to an original.
    if (!real) {
      for (let i = order.length - 1; i >= frame.start; i--) {
        const n = order[i]!;
        const e = done.get(n)!;
        if (e.real || e.res === n) continue;
        if ([...e.taint].some((t) => !same.has(t))) continue;
        e.res = n;
        e.taint = new Set();
        same.add(n);
      }
      if (out === node) same.add(node);
    }
    return entry;
  }

  return walk(schema).res;
}

function rebuild(node: $ZodType, sub: (child: $ZodType) => $ZodType): $ZodType {
  const def = node._zod.def as any;
  const patch: Record<string, unknown> = {};

  const one = (key: string) => {
    const child = def[key];
    if (!child) return;
    const r = sub(child);
    if (r !== child) patch[key] = r;
  };
  const list = (key: string) => {
    const arr = def[key] as readonly $ZodType[];
    let out: $ZodType[] | undefined;
    arr.forEach((child, i) => {
      const r = sub(child);
      if (r !== child) (out ??= [...arr])[i] = r;
    });
    if (out) patch[key] = out;
  };

  switch (def.type) {
    case "object": {
      const shape = def.shape as Record<string, $ZodType>;
      let out: Record<string, $ZodType> | undefined;
      for (const key of Object.keys(shape)) {
        const r = sub(shape[key]!);
        if (r !== shape[key]) (out ??= { ...shape })[key] = r;
      }
      if (out) patch.shape = out;
      one("catchall");
      break;
    }
    case "array":
      one("element");
      break;
    case "tuple":
      list("items");
      one("rest");
      break;
    case "record":
    case "map":
      one("keyType");
      one("valueType");
      break;
    case "set":
      one("valueType");
      break;
    case "union":
      list("options");
      break;
    case "intersection":
      one("left");
      one("right");
      break;
    case "optional":
    case "nullable":
    case "default":
    case "prefault":
    case "nonoptional":
    case "catch":
    case "readonly":
    case "promise":
    case "success":
      one("innerType");
      break;
    case "pipe":
      one("in");
      one("out");
      break;
    case "function":
      one("input");
      one("output");
      break;
    case "lazy": {
      const inner = (node as any)._zod.innerType as $ZodType | undefined;
      if (!inner) return node;
      const r = sub(inner);
      if (r === inner) return node;
      // `_cachedInner` would otherwise be carried over from the old def.
      return clone(node, mergeDefs(def, { getter: () => r, _cachedInner: r }));
    }
    default:
      return node;
  }

  return Object.keys(patch).length ? clone(node, mergeDefs(def, patch)) : node;
}
