import { $ZodLazy } from "./schemas.js";
import type { $ZodType } from "./schemas.js";
import { clone, partial } from "./util.js";

// Internal: deliberately not re-exported from any public barrel.

export type VisitCallback = (schema: $ZodType) => $ZodType;
export type VisitHandlers = { [type: string]: ((schema: any) => $ZodType) | undefined };
export type VisitRewrite = VisitCallback | VisitHandlers;

interface Entry {
  node: $ZodType;
  depth: number;
  /** Set once the node has been rewritten. */
  done: boolean;
  /** Final result. Mutable only because an untouched cycle is reverted to its original nodes. */
  result: $ZodType | undefined;
  /** Whether the rewrite changed this node or anything below it. */
  touched: boolean;
  /** Still-open cycle heads this node's (provisional) result refers to through a placeholder. */
  deps: Set<Entry>;
  /** A back-edge reached this node while it was in progress. */
  isHead: boolean;
  placeholder: $ZodType | undefined;
}

const REF = Symbol("ref");

/**
 * Rewrites a schema bottom-up. Children are rewritten first, the parent is re-cloned only if a
 * child changed, and `rewrite` is then applied to it. Untouched schemas come back as the same object.
 * Each unique node is visited once; cycles are closed with lazy references to the final result.
 */
export function visit(schema: $ZodType, rewrite: VisitRewrite): $ZodType {
  const memo = new Map<$ZodType, Entry>();
  const stack: Entry[] = [];
  // Entries whose result refers to an open cycle head; reverted if that cycle turns out untouched.
  const provisional: Entry[] = [];

  const apply = (s: $ZodType): $ZodType => {
    if (typeof rewrite === "function") return rewrite(s);
    const type = s._zod.def.type;
    const handler = Object.prototype.hasOwnProperty.call(rewrite, type) ? rewrite[type] : undefined;
    return handler ? handler(s) : s;
  };

  const markDep = (head: Entry) => {
    for (let i = head.depth + 1; i < stack.length; i++) stack[i]!.deps.add(head);
  };

  const placeholderFor = (head: Entry): $ZodType => {
    head.placeholder ??= new $ZodLazy({
      type: "lazy",
      getter: () => resolve(head),
    });
    return head.placeholder;
  };

  const resolve = (e: Entry): $ZodType => {
    if (!e.result) throw new Error("Recursive schema referenced before its rewrite finished");
    return e.result;
  };

  const run = (node: $ZodType, asRef: boolean): $ZodType | typeof REF => {
    const existing = memo.get(node);
    if (existing) {
      if (existing.done) {
        for (const d of existing.deps) if (!d.done) markDep(d);
        return existing.result!;
      }
      // back-edge into a node that is still being rewritten
      existing.isHead = true;
      markDep(existing);
      return asRef ? REF : placeholderFor(existing);
    }

    const e: Entry = {
      node,
      depth: stack.length,
      done: false,
      result: undefined,
      touched: false,
      deps: new Set(),
      isHead: false,
      placeholder: undefined,
    };
    memo.set(node, e);
    stack.push(e);

    const def: any = node._zod.def;
    let changed = false;
    let childTouched = false;

    const child = (c: $ZodType, asRef = false): any => {
      const r = run(c, asRef);
      const ce = memo.get(c)!;
      if (ce.done && ce.touched) childTouched = true;
      if (r !== c) changed = true;
      return r;
    };
    const children = (list: readonly $ZodType[]): readonly $ZodType[] => {
      const out = list.map((c) => child(c));
      return out.some((r, i) => r !== list[i]) ? out : list;
    };

    const patch: Record<string, unknown> = {};
    switch (def.type) {
      case "object": {
        const shape: Record<string, $ZodType> = def.shape;
        const next: Record<string, $ZodType> = {};
        let shapeChanged = false;
        for (const key of Object.keys(shape)) {
          const r = child(shape[key]!);
          if (r !== shape[key]) shapeChanged = true;
          Object.defineProperty(next, key, { value: r, enumerable: true, writable: true, configurable: true });
        }
        if (shapeChanged) patch.shape = next;
        if (def.catchall) patch.catchall = child(def.catchall);
        break;
      }
      case "array":
        patch.element = child(def.element);
        break;
      case "tuple":
        patch.items = children(def.items);
        if (def.rest) patch.rest = child(def.rest);
        break;
      case "record":
      case "map":
        patch.keyType = child(def.keyType);
        patch.valueType = child(def.valueType);
        break;
      case "set":
        patch.valueType = child(def.valueType);
        break;
      case "union":
        patch.options = children(def.options);
        break;
      case "intersection":
        patch.left = child(def.left);
        patch.right = child(def.right);
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
        patch.innerType = child(def.innerType);
        break;
      case "pipe":
        patch.in = child(def.in);
        patch.out = child(def.out);
        break;
      case "function":
        if (def.input) patch.input = child(def.input);
        if (def.output) patch.output = child(def.output);
        break;
      case "lazy": {
        const inner = (node as any)._zod.innerType as $ZodType;
        child(inner, true);
        patch.getter = () => resolve(memo.get(inner)!);
        // a previously resolved inner type is cached on the def and would shadow the rewritten one
        patch._cachedInner = undefined;
        break;
      }
      default:
        // leaves, and custom schemas with an unknown type, have nothing to traverse
        break;
    }

    const rebuilt = changed ? clone(node, { ...def, ...patch }, { parent: true }) : node;
    const result = apply(rebuilt);

    stack.pop();
    e.deps.delete(e);
    for (const d of e.deps) if (d.done) e.deps.delete(d);
    e.touched = childTouched || result !== rebuilt;
    e.done = true;
    e.result = result;

    if (e.isHead && !e.touched && e.deps.size === 0) {
      // Nothing in the cycle changed: the clones made around the placeholders are discarded.
      e.result = node;
      for (const p of provisional) if (p.deps.has(e)) p.result = p.node;
    } else if (e.deps.size > 0) {
      provisional.push(e);
    }
    return e.result;
  };

  return run(schema, false) as $ZodType;
}

/** Wraps every object in the tree in `.partial()`. `Optional` / `Union` are the flavour's constructors. */
export function deepPartial(schema: $ZodType, Optional: any, Union: any): $ZodType {
  return visit(schema, {
    object: (s) => partial(Optional, s as any, undefined),
    union: (s) => {
      const def: any = s._zod.def;
      if (def.discriminator === undefined) return s;
      // an optional discriminator breaks the lookup, so fall back to a plain union
      const { discriminator: _d, unionFallback: _u, ...rest } = def;
      return new Union(rest);
    },
  });
}

/** Replaces every pipe in the tree with one of its sides. */
export function replacePipes(schema: $ZodType, side: "in" | "out", unknown: () => $ZodType): $ZodType {
  return visit(schema, {
    pipe: (s) => {
      const picked: $ZodType = (s._zod.def as any)[side];
      // a transform has no schema of its own for the value it takes or produces
      return picked._zod.def.type === "transform" ? unknown() : picked;
    },
  });
}
