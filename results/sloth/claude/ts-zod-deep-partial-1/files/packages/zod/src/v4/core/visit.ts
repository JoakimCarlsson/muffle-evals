import type { $ZodType, $ZodTypeDef } from "./schemas.js";
import { clone, cloneDef } from "./util.js";

export type Rewrite =
  | ((schema: $ZodType) => $ZodType)
  | { [K in $ZodTypeDef["type"]]?: (schema: any) => $ZodType };

interface Entry {
  node: $ZodType;
  out: $ZodType;
  /** a child (or the rewrite) really changed this node */
  changed: boolean;
  /** in-progress nodes that `out` references through cycle back-edges */
  deps: Set<$ZodType>;
  back?: true;
}

const slots = new Map<string, string[]>(
  Object.entries({
    object: ["shape", "catchall"],
    array: ["element"],
    tuple: ["items", "rest"],
    record: ["keyType", "valueType"],
    map: ["keyType", "valueType"],
    set: ["valueType"],
    union: ["options"],
    intersection: ["left", "right"],
    optional: ["innerType"],
    nullable: ["innerType"],
    default: ["innerType"],
    prefault: ["innerType"],
    nonoptional: ["innerType"],
    catch: ["innerType"],
    readonly: ["innerType"],
    promise: ["innerType"],
    success: ["innerType"],
    pipe: ["in", "out"],
    function: ["input", "output"],
    lazy: [],
  })
);

const leaves = new Set([
  "string",
  "number",
  "int",
  "boolean",
  "bigint",
  "symbol",
  "null",
  "undefined",
  "void",
  "never",
  "any",
  "unknown",
  "date",
  "file",
  "enum",
  "literal",
  "transform",
  "nan",
  "template_literal",
  "custom",
]);

const isSchema = (v: unknown): v is $ZodType => !!v && typeof v === "object" && "_zod" in v;

/**
 * Rewrites a schema bottom-up and returns the new schema.
 *
 * Children are rewritten first; a parent is re-cloned only if a child changed, so an untouched
 * schema is returned as the same object. Every unique node is rewritten once, and cycles
 * (lazy and getter recursion) are tied back to the rewritten node through getters.
 * `rewrite` is a callback run on every node, or a handler map keyed by `def.type`.
 * Nodes with an unknown `def.type` are returned untouched.
 */
export function visit(schema: $ZodType, rewrite: Rewrite): $ZodType {
  const apply =
    typeof rewrite === "function"
      ? rewrite
      : (s: $ZodType) => {
          const handler = Object.prototype.hasOwnProperty.call(rewrite, s._zod.def.type)
            ? rewrite[s._zod.def.type]
            : undefined;
          return handler ? handler(s) : s;
        };
  const done = new Map<$ZodType, Entry>();
  const active = new Set<$ZodType>();
  const pending: Entry[] = [];

  const settled = (node: $ZodType, out: $ZodType = node): Entry => {
    const entry: Entry = { node, out, changed: false, deps: new Set() };
    done.set(node, entry);
    return entry;
  };

  const walk = (node: $ZodType): Entry => {
    const hit = done.get(node);
    if (hit) return hit;
    if (active.has(node)) return { node, out: node, changed: false, deps: new Set([node]), back: true };

    const def = node._zod.def as any;
    const keys = slots.get(def.type);
    if (!keys) {
      if (!leaves.has(def.type)) return settled(node);
      const entry = settled(node, apply(node));
      entry.changed = entry.out !== node;
      return entry;
    }

    active.add(node);
    const deps = new Set<$ZodType>();
    let dirty = false;
    let childChanged = false;
    const newDef = cloneDef(node);

    const put = (target: any, key: PropertyKey, child: $ZodType) => {
      const e = walk(child);
      dirty ||= e.out !== child || !!e.back;
      childChanged ||= e.changed;
      for (const d of e.deps) deps.add(d);
      Object.defineProperty(
        target,
        key,
        e.back
          ? { get: () => done.get(child)?.out ?? child, enumerable: true, configurable: true }
          : { value: e.out, enumerable: true, configurable: true, writable: true }
      );
    };

    if (def.type === "lazy") {
      const inner = (node._zod as any).innerType as $ZodType;
      const holder: { inner?: $ZodType } = {};
      put(holder, "inner", inner);
      delete newDef._cachedInner;
      Object.defineProperty(newDef, "getter", { value: () => holder.inner, enumerable: true, configurable: true });
    }
    for (const key of keys) {
      const value = def[key];
      if (isSchema(value)) {
        put(newDef, key, value);
      } else if (Array.isArray(value)) {
        const copy: $ZodType[] = [];
        value.forEach((child, i) => put(copy, i, child));
        Object.defineProperty(newDef, key, { value: copy, enumerable: true, configurable: true, writable: true });
      } else if (value && typeof value === "object") {
        const copy: Record<string, $ZodType> = {};
        for (const k of Object.keys(value)) put(copy, k, value[k]);
        Object.defineProperty(newDef, key, { value: copy, enumerable: true, configurable: true, writable: true });
      }
    }

    active.delete(node);
    const rebuilt = dirty ? clone(node, newDef, { parent: true }) : node;
    const out = apply(rebuilt);
    const changed = childChanged || out !== rebuilt;
    deps.delete(node);

    const entry = settled(node, out);
    entry.changed = changed;
    entry.deps = deps;
    if (!changed && dirty) {
      if (deps.size) pending.push(entry);
      else entry.out = node;
    }
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i]!;
      if (!p.deps.delete(node) || p.deps.size) continue;
      if (!changed) p.out = p.node;
      pending.splice(i, 1);
    }
    return entry;
  };

  return walk(schema).out;
}

/**
 * Replaces every pipe (codecs and preprocess included) in the tree with its input or output side.
 */
export function unpipe(schema: $ZodType, side: "in" | "out"): $ZodType {
  return visit(schema, { pipe: (s) => s._zod.def[side] });
}
