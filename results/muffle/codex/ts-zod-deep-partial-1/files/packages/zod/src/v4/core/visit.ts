import type { $ZodType } from "./schemas.js";
import { clone } from "./util.js";

export type Rewrite = ((schema: $ZodType) => $ZodType) | Record<string, (schema: $ZodType) => $ZodType>;

/** Internal, identity-preserving traversal of the schema graph. */
export function visit(schema: $ZodType, rewrite: Rewrite): $ZodType {
  type Node = {
    schema: $ZodType;
    def: any;
    edges: [string, Node][];
    index: number;
    low: number;
    active: boolean;
    result: $ZodType;
  };
  const nodes = new Map<$ZodType, Node>();
  const stack: Node[] = [];
  let index = 0;
  const apply = (s: $ZodType) => (typeof rewrite === "function" ? rewrite(s) : (rewrite[s._zod.def.type]?.(s) ?? s));
  function walk(s: $ZodType): Node {
    const existing = nodes.get(s);
    if (existing) return existing;
    const original: any = s._zod.def;
    const def = { ...original };
    const children: [string, $ZodType][] = [];
    const add = (key: string) => {
      if (original[key]) children.push([key, original[key]]);
    };
    switch (original.type) {
      case "object":
        def.shape = { ...original.shape };
        for (const key of Object.keys(def.shape)) children.push([`shape:${key}`, def.shape[key]]);
        add("catchall");
        break;
      case "array":
        add("element");
        break;
      case "tuple":
        def.items = [...original.items];
        original.items.forEach((s: $ZodType, i: number) => children.push([`items:${i}`, s]));
        add("rest");
        break;
      case "union":
        def.options = [...original.options];
        original.options.forEach((s: $ZodType, i: number) => children.push([`options:${i}`, s]));
        break;
      case "record":
      case "map":
        add("keyType");
        add("valueType");
        break;
      case "set":
        add("valueType");
        break;
      case "intersection":
        add("left");
        add("right");
        break;
      case "pipe":
        add("in");
        add("out");
        break;
      case "function":
        add("input");
        add("output");
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
        add("innerType");
        break;
      case "lazy":
        children.push(["getter", (s._zod as any).innerType]);
        delete def._cachedInner;
        break;
      case "string":
      case "number":
      case "boolean":
      case "bigint":
      case "symbol":
      case "undefined":
      case "null":
      case "any":
      case "unknown":
      case "never":
      case "void":
      case "date":
      case "enum":
      case "literal":
      case "file":
      case "transform":
      case "nan":
      case "template_literal":
      case "custom":
        break;
      default:
        return { schema: s, def, edges: [], index: -1, low: -1, active: false, result: s };
    }
    const node: Node = { schema: s, def, edges: [], index, low: index++, active: true, result: s };
    nodes.set(s, node);
    stack.push(node);
    for (const [key, child] of children) {
      const seen = nodes.has(child);
      const target = walk(child);
      node.edges.push([key, target]);
      if (target.active) node.low = Math.min(node.low, seen ? target.index : target.low);
    }
    // Finish strongly connected components together: recursive edges must point
    // to final results without deferring any user callbacks until parse time.
    if (node.low === node.index) {
      const group: Node[] = [];
      let member: Node;
      do {
        member = stack.pop()!;
        member.active = false;
        group.push(member);
      } while (member !== node);
      const members = new Set(group);
      const cyclic = group.length > 1 || node.edges.some(([, child]) => child === node);
      const changed = group.some((n) =>
        n.edges.some(([, child]) => !members.has(child) && child.result !== child.schema)
      );
      // Definition getters keep back references current when rewrite replaces
      // an entire node (for example, an object or a pipe).
      function prepare(n: Node) {
        for (const [key, child] of n.edges) {
          const colon = key.indexOf(":");
          if (key === "getter") n.def.getter = () => child.result;
          else if (colon !== -1)
            Object.defineProperty(n.def[key.slice(0, colon)], key.slice(colon + 1), {
              enumerable: true,
              configurable: true,
              get: () => child.result,
            });
          else Object.defineProperty(n.def, key, { enumerable: true, configurable: true, get: () => child.result });
        }
      }
      for (const n of group) {
        prepare(n);
        if (cyclic || changed) n.result = clone(n.schema, n.def);
      }
      let rewritten = false;
      for (const n of group) {
        const before = n.result;
        n.result = apply(before);
        rewritten ||= n.result !== before;
      }
      if (cyclic && !changed && !rewritten) for (const n of group) n.result = n.schema;
    }
    return node;
  }
  return walk(schema).result;
}
