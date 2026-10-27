import type { $ZodType } from "./schemas.js";
import { clone, cloneDef } from "./util.js";

type Rewrite = (schema: $ZodType) => $ZodType;
export type Visitor = Rewrite | { [kind: string]: Rewrite | undefined };

// Keep this module internal: all public operations share the same graph walk.
export function visit(schema: $ZodType, rewrite: Visitor): $ZodType {
  type Node = { schema: $ZodType; def: any; edges: $ZodType[]; index: number; low: number; active: boolean };
  const nodes = new Map<$ZodType, Node>();
  const results = new Map<$ZodType, $ZodType>();
  const stack: Node[] = [];
  let index = 0;

  function mapDef(s: $ZodType, map: (s: $ZodType) => $ZodType): any {
    const d = s._zod.def as any;
    const next = cloneDef(s);
    const set = (key: string, value: unknown) => {
      Object.defineProperty(next, key, { value, writable: true, configurable: true, enumerable: true });
    };
    const field = (key: string) => {
      if (d[key]) set(key, map(d[key]));
    };
    switch (d.type) {
      case "object":
        set("shape", Object.fromEntries(Object.entries(d.shape).map(([k, v]) => [k, map(v as $ZodType)])));
        field("catchall");
        break;
      case "array":
        field("element");
        break;
      case "tuple":
        set("items", d.items.map(map));
        field("rest");
        break;
      case "record":
      case "map":
        field("keyType");
        field("valueType");
        break;
      case "set":
        field("valueType");
        break;
      case "union":
        set("options", d.options.map(map));
        break;
      case "template_literal":
        set(
          "parts",
          d.parts.map((part: unknown) =>
            typeof part === "object" && part !== null && "_zod" in part ? map(part as $ZodType) : part
          )
        );
        break;
      case "intersection":
        field("left");
        field("right");
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
        field("innerType");
        break;
      case "pipe":
        field("in");
        field("out");
        break;
      case "function":
        field("input");
        field("output");
        break;
      case "lazy": {
        const inner = map((s._zod as any).innerType);
        delete next._cachedInner;
        set("getter", () => inner);
        break;
      }
    }
    return next;
  }
  function walk(s: $ZodType): void {
    if (nodes.has(s)) return;
    const n: Node = { schema: s, def: undefined, edges: [], index, low: index++, active: true };
    nodes.set(s, n);
    stack.push(n);
    n.def = mapDef(s, (child) => {
      n.edges.push(child);
      return child;
    });
    for (const child of n.edges) {
      if (!nodes.has(child)) {
        walk(child);
        n.low = Math.min(n.low, nodes.get(child)!.low);
      } else if (nodes.get(child)!.active) n.low = Math.min(n.low, nodes.get(child)!.index);
    }
    if (n.low !== n.index) return;
    const component: Node[] = [];
    let member: Node;
    do {
      member = stack.pop()!;
      member.active = false;
      component.push(member);
    } while (member !== n);
    const cyclic = component.length > 1 || n.edges.includes(s);
    const refs = new Map<$ZodType, $ZodType>();
    if (cyclic) {
      // Forward references close a recursive component without running the visitor
      // again when a lazy getter or recursive object is parsed later.
      for (const item of component) {
        refs.set(
          item.schema,
          new Proxy({} as $ZodType, {
            get(_target, key) {
              return Reflect.get(results.get(item.schema) ?? item.schema, key);
            },
            getPrototypeOf() {
              return Object.getPrototypeOf(results.get(item.schema) ?? item.schema);
            },
            has(_target, key) {
              return key in (results.get(item.schema) ?? item.schema);
            },
          })
        );
      }
    }
    let changed = false;
    for (const item of component) {
      let childChanged = false;
      const def = mapDefFromSnapshot(item, (child) => {
        const result = refs.get(child) ?? results.get(child) ?? child;
        if (!refs.has(child) && result !== child) childChanged = true;
        return result;
      });
      const candidate = childChanged || cyclic ? clone(item.schema, def) : item.schema;
      const type = item.schema._zod.def.type;
      const known = builtins.has(type);
      const handler = typeof rewrite === "function" ? rewrite : rewrite[type];
      const result = known && handler ? handler(candidate) : candidate;
      if (childChanged || result !== candidate) changed = true;
      results.set(item.schema, result);
    }
    if (cyclic && !changed) for (const item of component) results.set(item.schema, item.schema);
  }
  function mapDefFromSnapshot(n: Node, map: (s: $ZodType) => $ZodType) {
    // Discovery evaluates object getters exactly once. Re-use those children.
    let i = 0;
    const snapshot = { _zod: { def: n.def, innerType: n.edges[0] } } as unknown as $ZodType;
    return mapDef(snapshot, () => map(n.edges[i++]!));
  }
  walk(schema);
  return results.get(schema)!;
}

const builtins = new Set([
  "string",
  "number",
  "boolean",
  "bigint",
  "symbol",
  "undefined",
  "null",
  "any",
  "unknown",
  "never",
  "void",
  "date",
  "array",
  "object",
  "union",
  "intersection",
  "tuple",
  "record",
  "map",
  "set",
  "enum",
  "literal",
  "file",
  "transform",
  "optional",
  "nullable",
  "default",
  "prefault",
  "nonoptional",
  "success",
  "catch",
  "nan",
  "pipe",
  "readonly",
  "template_literal",
  "function",
  "promise",
  "lazy",
  "custom",
]);
