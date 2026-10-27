import type { $ZodType } from "./schemas.js";
import { clone } from "./util.js";

export type Rewrite = ((schema: $ZodType) => $ZodType) | Record<string, ((schema: any) => $ZodType) | undefined>;

/** Rewrite each unique built-in schema from its children upward. */
export function visit(schema: $ZodType, rewrite: Rewrite): $ZodType {
  type Node = {
    source: $ZodType;
    def: any;
    children: $ZodType[];
    index: number;
    low: number;
    active: boolean;
    result: $ZodType;
    proxy?: $ZodType;
  };
  const nodes = new Map<$ZodType, Node>();
  const stack: Node[] = [];
  const components: Node[][] = [];
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
    "literal",
    "enum",
    "file",
    "transform",
    "custom",
  ]);
  const fields: Record<string, string[]> = {
    array: ["element"],
    tuple: ["items", "rest"],
    record: ["keyType", "valueType"],
    map: ["keyType", "valueType"],
    set: ["valueType"],
    union: ["options"],
    xor: ["options"],
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
    template_literal: [],
    function: ["input", "output"],
    object: ["catchall"],
    lazy: [],
  };
  /** Capture child references once, including recursive object getters. */
  function definition(def: any, child: (schema: $ZodType) => $ZodType, resolvedInner?: $ZodType): any {
    const next = { ...def };
    for (const key of fields[def.type] ?? []) {
      if (Array.isArray(def[key])) next[key] = def[key].map(child);
      else if (def[key]) next[key] = child(def[key]);
    }
    if (def.type === "object")
      next.shape = Object.fromEntries(Object.entries(def.shape).map(([key, value]) => [key, child(value as $ZodType)]));
    if (def.type === "template_literal") next.parts = def.parts.map((part: any) => (part?._zod ? child(part) : part));
    if (def.type === "lazy") {
      const inner = child(resolvedInner ?? def.getter());
      next.getter = () => inner;
      delete next._cachedInner;
    }
    return next;
  }
  /** Collect strongly connected components in child-first order. */
  function discover(source: $ZodType): void {
    const type = source._zod.def.type;
    if (nodes.has(source) || (!leaves.has(type) && !Object.prototype.hasOwnProperty.call(fields, type))) return;
    const node: Node = {
      source,
      def: undefined,
      children: [],
      index: nodes.size,
      low: nodes.size,
      active: true,
      result: source,
    };
    nodes.set(source, node);
    stack.push(node);
    node.def = definition(
      source._zod.def,
      (child) => {
        node.children.push(child);
        const existing = nodes.get(child);
        if (!existing) {
          discover(child);
          const found = nodes.get(child);
          if (found?.active) node.low = Math.min(node.low, found.low);
        } else if (existing.active) node.low = Math.min(node.low, existing.index);
        return child;
      },
      type === "lazy" ? (source._zod as any).innerType : undefined
    );
    if (node.low === node.index) {
      const component: Node[] = [];
      let current: Node;
      do {
        current = stack.pop()!;
        current.active = false;
        component.push(current);
      } while (current !== node);
      components.push(component);
    }
  }
  discover(schema);
  for (const component of components) {
    const members = new Set(component);
    const pending = new Set<Node>();
    const done = new Set<Node>();
    let changed = false;
    /** Rewrite a component, deferring its recursive references. */
    function walk(node: Node): $ZodType {
      if (done.has(node)) return node.proxy ?? node.result;
      if (pending.has(node)) {
        return (node.proxy ??= new Proxy(Object.create(Object.getPrototypeOf(node.source)), {
          get: (_, key) => Reflect.get(node.result, key),
        }));
      }
      pending.add(node);
      let childChanged = false;
      let position = 0;
      const next = definition(node.def, () => {
        const child = node.children[position++]!;
        const entry = nodes.get(child);
        const result = entry ? (members.has(entry) ? walk(entry) : (entry.proxy ?? entry.result)) : child;
        childChanged ||= child !== result;
        if (entry && !members.has(entry) && result !== child) changed = true;
        return result;
      });
      const candidate = childChanged ? clone(node.source, next) : node.source;
      const handler = typeof rewrite === "function" ? rewrite : rewrite[node.def.type];
      node.result = handler ? handler(candidate) : candidate;
      changed ||= node.result !== candidate;
      done.add(node);
      return node.proxy ?? node.result;
    }
    walk(component[component.length - 1]!);
    if (!changed) {
      for (const node of component) {
        node.result = node.source;
        delete node.proxy;
      }
    }
  }
  const root = nodes.get(schema);
  return root?.proxy ?? root?.result ?? schema;
}
