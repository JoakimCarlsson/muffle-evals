import type { $ZodType } from "./schemas.js";
import { clone } from "./util.js";

type Rewrite = ((schema: $ZodType) => $ZodType) | Record<string, (schema: any) => $ZodType>;

/** Rewrite a schema graph bottom-up, preserving unchanged nodes and shared references. */
export function visit(schema: $ZodType, rewrite: Rewrite): $ZodType {
  const results = new Map<$ZodType, $ZodType>();
  const edges = new Map<$ZodType, $ZodType[]>();
  const definitions = new Map<$ZodType, any>();
  const active = new Set<$ZodType>();
  const cyclic = new Set<$ZodType>();
  const rewritten = new Set<$ZodType>();

  /** Resolve children once and construct references to their final replacements. */
  function walk(node: $ZodType): $ZodType {
    if (results.has(node)) {
      if (active.has(node)) for (const ancestor of active) cyclic.add(ancestor);
      return results.get(node)!;
    }
    active.add(node);
    results.set(node, node);
    const def: any = node._zod.def;
    const next = Object.create(Object.getPrototypeOf(def), Object.getOwnPropertyDescriptors(def));
    const children: $ZodType[] = [];
    edges.set(node, children);
    definitions.set(node, next);

    /** Retain a reference that also resolves recursive replacements. */
    function child(target: any, key: string | number, value: $ZodType): void {
      children.push(value);
      walk(value);
      Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => results.get(value)! });
    }

    switch (def.type) {
      case "object":
        Object.defineProperty(next, "shape", { value: {}, enumerable: true, configurable: true, writable: true });
        for (const key of Object.keys(def.shape)) child(next.shape, key, def.shape[key]);
        if (def.catchall) child(next, "catchall", def.catchall);
        break;
      case "array":
        child(next, "element", def.element);
        break;
      case "tuple":
        next.items = [...def.items];
        def.items.forEach((item: $ZodType, i: number) => child(next.items, i, item));
        if (def.rest) child(next, "rest", def.rest);
        break;
      case "record":
      case "map":
        child(next, "keyType", def.keyType);
        child(next, "valueType", def.valueType);
        break;
      case "set":
        child(next, "valueType", def.valueType);
        break;
      case "union":
        next.options = [...def.options];
        def.options.forEach((option: $ZodType, i: number) => child(next.options, i, option));
        break;
      case "intersection":
        child(next, "left", def.left);
        child(next, "right", def.right);
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
        child(next, "innerType", def.innerType);
        break;
      case "pipe":
        child(next, "in", def.in);
        child(next, "out", def.out);
        break;
      case "function":
        child(next, "input", def.input);
        child(next, "output", def.output);
        break;
      case "lazy": {
        const inner = (def._cachedInner ?? def.getter()) as $ZodType;
        children.push(inner);
        walk(inner);
        delete next._cachedInner;
        next.getter = () => results.get(inner)!;
        break;
      }
      case "string":
      case "number":
      case "bigint":
      case "boolean":
      case "date":
      case "symbol":
      case "undefined":
      case "null":
      case "any":
      case "unknown":
      case "never":
      case "void":
      case "nan":
      case "literal":
      case "enum":
      case "file":
      case "transform":
      case "custom":
      case "template_literal":
        break;
      default:
        active.delete(node);
        return node;
    }
    active.delete(node);
    const rebuilt = cyclic.has(node) || children.some((c) => results.get(c) !== c) ? clone(node, next) : node;
    const handler = typeof rewrite === "function" ? rewrite : rewrite[def.type];
    const result = handler ? handler(rebuilt) : rebuilt;
    if (result !== rebuilt) rewritten.add(node);
    results.set(node, result);
    return result;
  }

  walk(schema);
  const affected = new Set(rewritten);
  let pending = true;
  while (pending) {
    pending = false;
    for (const [node, children] of edges) {
      if (!affected.has(node) && children.some((child) => affected.has(child))) {
        affected.add(node);
        pending = true;
      }
    }
  }
  for (const node of results.keys()) {
    if (!affected.has(node)) results.set(node, node);
    else if (results.get(node) === node) results.set(node, clone(node, definitions.get(node)));
  }
  return results.get(schema)!;
}
