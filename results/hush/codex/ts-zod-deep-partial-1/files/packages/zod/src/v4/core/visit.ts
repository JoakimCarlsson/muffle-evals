import type { $ZodType } from "./schemas.js";
import { clone } from "./util.js";

type Rewrite = ((schema: $ZodType) => $ZodType) | Partial<Record<string, (schema: any) => $ZodType>>;
const leaves = new Set([
  "string",
  "number",
  "bigint",
  "boolean",
  "date",
  "symbol",
  "undefined",
  "null",
  "any",
  "unknown",
  "never",
  "void",
  "nan",
  "enum",
  "literal",
  "file",
  "transform",
  "custom",
  "template_literal",
]);

/** Copy a definition, mapping only its schema-valued fields. Lazy getters are resolved once. */
function definition(schema: $ZodType, map: (child: $ZodType) => $ZodType): any {
  const def = schema._zod.def as any;
  const next = { ...def };
  switch (def.type) {
    case "object":
      next.shape = Object.fromEntries(Object.entries(def.shape).map(([key, value]) => [key, map(value as $ZodType)]));
      if (def.catchall) next.catchall = map(def.catchall);
      break;
    case "array":
      next.element = map(def.element);
      break;
    case "tuple":
      next.items = def.items.map(map);
      if (def.rest) next.rest = map(def.rest);
      break;
    case "record":
    case "map":
      next.keyType = map(def.keyType);
      next.valueType = map(def.valueType);
      break;
    case "set":
      next.valueType = map(def.valueType);
      break;
    case "union":
      next.options = def.options.map(map);
      break;
    case "intersection":
      next.left = map(def.left);
      next.right = map(def.right);
      break;
    case "pipe":
      next.in = map(def.in);
      next.out = map(def.out);
      break;
    case "function":
      next.input = map(def.input);
      next.output = map(def.output);
      break;
    case "lazy": {
      const inner = map((schema._zod as any).innerType);
      delete next._cachedInner;
      next.getter = () => inner;
      break;
    }
    case "optional":
    case "nullable":
    case "default":
    case "prefault":
    case "nonoptional":
    case "catch":
    case "readonly":
    case "promise":
    case "success":
      next.innerType = map(def.innerType);
      break;
    default:
      return leaves.has(def.type) ? next : undefined;
  }
  return next;
}

/** Rewrite a schema graph bottom-up, preserving shared nodes and unchanged identities. */
export function visit(schema: $ZodType, rewrite: Rewrite): $ZodType {
  const rewritten = new Map<$ZodType, $ZodType>();
  function walk(node: $ZodType): $ZodType {
    if (rewritten.has(node)) return rewritten.get(node)!;
    rewritten.set(node, node);
    let changed = false;
    const def = definition(node, (child) => {
      const result = walk(child);
      changed ||= result !== child;
      return result;
    });
    if (!def) return node;
    const candidate = changed ? clone(node, def) : node;
    const fn = typeof rewrite === "function" ? rewrite : rewrite[node._zod.def.type];
    const result = fn ? fn(candidate) : candidate;
    rewritten.set(node, result);
    return result;
  }
  const root = walk(schema);
  // Reconnect back edges after callbacks have run. No callback is deferred to parsing.
  function target(node: $ZodType): $ZodType {
    const seen = new Set<$ZodType>();
    while (rewritten.has(node) && rewritten.get(node) !== node && !seen.has(node)) {
      seen.add(node);
      node = rewritten.get(node)!;
    }
    return node;
  }
  const parents = new Map<$ZodType, Set<$ZodType>>();
  const defs = new Map<$ZodType, any>();
  const dirty = new Set<$ZodType>();
  function collect(node: $ZodType) {
    if (defs.has(node)) return;
    defs.set(node, undefined);
    const def = definition(node, (child) => {
      const resolved = target(child);
      if (resolved !== child) dirty.add(node);
      if (!parents.has(resolved)) parents.set(resolved, new Set());
      parents.get(resolved)!.add(node);
      collect(resolved);
      return resolved;
    });
    defs.set(node, def);
  }
  collect(target(root));
  const queue = [...dirty];
  for (let i = 0; i < queue.length; i++) {
    for (const parent of parents.get(queue[i]!) ?? []) {
      if (!dirty.has(parent)) {
        dirty.add(parent);
        queue.push(parent);
      }
    }
  }
  const copies = new Map<$ZodType, $ZodType>();
  // Allocate all copies before reconnecting recursive references.
  for (const node of dirty) copies.set(node, clone(node, defs.get(node)));
  for (const node of dirty) {
    const def = definition(node, (child) => copies.get(target(child)) ?? target(child));
    const copy = copies.get(node)!;
    Object.defineProperties(copy._zod.def, Object.getOwnPropertyDescriptors(def));
    // Some frontends expose schema children as eager instance properties.
    for (const key of Object.keys(copy)) {
      const value = (copy as any)[key];
      if (value && typeof value === "object" && value._zod) {
        (copy as any)[key] = copies.get(target(value)) ?? target(value);
      }
    }
  }
  return copies.get(target(root)) ?? target(root);
}
