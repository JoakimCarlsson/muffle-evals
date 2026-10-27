import { expect, test } from "vitest";
import * as z from "../index.js";
import * as mini from "../../mini/index.js";
import { visit } from "../../core/visit.js";

for (const source of [z, mini]) {
  const api = source as typeof z;
  test(`${api === z ? "classic" : "mini"} recursive deep partial and projections`, () => {
    const inner = api.object({ name: api.string() });
    const schema = api.object({
      array: api.array(inner),
      tuple: api.tuple([inner], inner),
      record: api.record(api.string(), inner),
      map: api.map(api.string(), inner),
      set: api.set(inner),
      optional: api.optional(inner),
      nullable: api.nullable(inner),
      default: api._default(inner, { name: "a" }),
      prefault: api.prefault(inner, { name: "a" }),
      readonly: api.readonly(inner),
      catch: api.catch(inner, { name: "a" }),
      nonoptional: api.nonoptional(api.optional(inner)),
      union: api.union([inner, api.string()]),
      intersection: api.intersection(inner, inner),
      success: api.success(inner),
    });
    const partial = api.deepPartial(schema);
    expect(
      partial.parse({
        array: [{}],
        tuple: [{}],
        record: { a: {} },
        map: new Map([["a", {}]]),
        set: new Set([{}]),
        optional: {},
        nullable: {},
        default: {},
        prefault: {},
        readonly: {},
        catch: {},
        nonoptional: {},
        union: {},
        intersection: {},
        success: {},
      })
    ).toBeDefined();
    expect(partial.safeParse({ tuple: [] }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
    const codec = api.codec(api.string(), api.bigint(), { decode: BigInt, encode: String });
    const codecs = api.object({ b: codec, r: api.record(api.string(), codec), m: api.map(api.string(), codec) });
    expect(api.output(codecs).parse({ b: 1n, r: { a: 2n }, m: new Map([["a", 3n]]) })).toBeDefined();
    expect(api.input(codecs).parse({ b: "1", r: {}, m: new Map() })).toBeDefined();
    expect(api.output(inner)).toBe(inner);
    const Node = api.object({
      name: api.string(),
      get children(): any {
        return api.array(Node);
      },
    });
    expect(api.deepPartial(Node).parse({ children: [{ children: [{}] }] })).toBeDefined();
    const Lazy: any = api.lazy(() => api.object({ name: api.string(), children: api.array(Lazy) }));
    Lazy.parse({ name: "a", children: [] });
    expect(api.deepPartial(Lazy).parse({ children: [{ children: [{}] }] })).toBeDefined();
    expect(
      api
        .deepPartial(
          api.discriminatedUnion("kind", [
            api.object({ kind: api.literal("a"), name: api.string() }),
            api.object({ kind: api.literal("b") }),
          ])
        )
        .parse({})
    ).toEqual({});
  });
}

test("visit preserves identities and visits shared nodes once", () => {
  const inner = z.object({ name: z.string() });
  const root = z.object({ x: inner, y: inner });
  let count = 0;
  expect(
    visit(root, (node) => {
      count++;
      return node;
    })
  ).toBe(root);
  expect(count).toBe(3);
  const updated = visit(root, { string: () => z.number() }) as typeof root;
  expect(updated.shape.x).toBe(updated.shape.y);
  expect(updated.parse({ x: { name: 1 }, y: { name: 2 } })).toBeDefined();
});

test("checks, catchalls, codecs, preprocess, promises and structural methods", async () => {
  const checked = z.string().min(1);
  expect(z.deepPartial(checked)).toBe(checked);
  expect(z.deepPartial(checked).safeParse("").success).toBe(false);
  const object = z.deepPartial(z.object({ nested: z.object({ value: z.string() }) }));
  expect(object.shape.nested.unwrap().shape.value).toBeDefined();
  expect(object.extend({ other: z.string() }).keyof().options).toContain("other");
  expect(z.deepPartial(z.object({}).catchall(z.object({ value: z.string() }))).parse({ a: {} })).toEqual({ a: {} });
  expect(z.deepPartial(z.strictObject({ a: z.string() })).safeParse({ extra: 1 }).success).toBe(false);
  expect(z.deepPartial(z.looseObject({ a: z.string() })).parse({ extra: 1 })).toEqual({ extra: 1 });
  const codec = z.codec(z.object({ a: z.string() }), z.object({ b: z.string() }), {
    decode: () => ({}),
    encode: () => ({}),
  } as any);
  expect(z.deepPartial(codec)._zod.def.reverseTransform).toBe(codec._zod.def.reverseTransform);
  expect(z.deepPartial(z.preprocess((x) => x, z.object({ a: z.string() }))).parse({})).toEqual({});
  expect(await z.deepPartial(z.promise(z.object({ a: z.string() }))).parseAsync(Promise.resolve({}))).toEqual({});
});

test("recursive visit preserves untouched siblings and never rewrites at parse time", () => {
  const Node = z.object({
    value: z.string(),
    get children() {
      return z.array(Node);
    },
  });
  const root = z.object({ node: Node, value: z.number() });
  const changed = visit(root, { number: () => z.string() }) as typeof root;
  expect(changed.shape.node).toBe(Node);
  expect(visit(Node, (node) => node)).toBe(Node);
  let count = 0;
  const rewritten = visit(Node, (node) => {
    count++;
    return node._zod.def.type === "string" ? z.number() : node;
  }) as typeof Node;
  expect(count).toBe(3);
  expect(rewritten.parse({ value: 1, children: [{ value: 2, children: [] }] })).toBeDefined();
  expect(count).toBe(3);
  const Lazy: z.ZodType = z.lazy(() => z.object({ value: z.string(), child: z.optional(Lazy) }));
  Lazy.parse({ value: "a" });
  const lazyResult = visit(Lazy, { string: () => z.number() }) as z.ZodType;
  expect(lazyResult.parse({ value: 1, child: { value: 2 } })).toBeDefined();
  const custom = { _zod: { def: { type: "unrecognized" } } } as any;
  expect(
    visit(custom, () => {
      throw new Error("unknown node");
    })
  ).toBe(custom);
});

test("recursive structural types and mini object operations", () => {
  const Node = z.object({
    value: z.string(),
    get children() {
      return z.array(Node);
    },
  });
  const partial = z.deepPartial(Node);
  const value: z.input<typeof partial> = { children: [{ children: [{}] }] };
  expect(partial.parse(value)).toEqual(value);
  expect(partial.shape.children.unwrap().element.shape.value).toBeDefined();
  expect(partial.shape.children.unwrap().element).toBe(partial);
  const small = mini.deepPartial(mini.object({ nested: mini.object({ name: mini.string() }) }));
  expect(mini.keyof(mini.extend(small, { other: mini.string() })).options).toContain("other");
  const output = z.output(z.object({ value: z.codec(z.string(), z.bigint(), { decode: BigInt, encode: String }) }));
  const result: z.output<typeof output> = { value: 1n };
  expect(output.parse(result)).toEqual(result);
});

test("visit handles functions, tuple rest, nested pipes and bottom-up callbacks", () => {
  const number = z.number();
  const object = z.object({ value: number });
  const order: string[] = [];
  visit(object, (node) => {
    order.push(node._zod.def.type);
    return node;
  });
  expect(order).toEqual(["number", "object"]);
  const fn = z.function({ input: [object], output: object });
  const partial = z.deepPartial(fn).implement((value) => value);
  expect(partial({})).toEqual({});
  const tuple = z.deepPartial(z.tuple([object], object));
  expect(tuple.parse([{}, {}, {}])).toEqual([{}, {}, {}]);
  expect(tuple.safeParse([]).success).toBe(false);
  const stringToBigInt = z.codec(z.string(), z.bigint(), { decode: BigInt, encode: String });
  const wrappers = [
    z.array(stringToBigInt),
    z.tuple([stringToBigInt], stringToBigInt),
    z.set(stringToBigInt),
    z.optional(stringToBigInt),
    z.nullable(stringToBigInt),
    z.readonly(stringToBigInt),
    z._default(stringToBigInt, 1n),
    z.prefault(stringToBigInt, "1"),
    z.catch(stringToBigInt, 1n),
    z.nonoptional(stringToBigInt),
    z.union([stringToBigInt, z.boolean()]),
    z.intersection(z.object({ a: stringToBigInt }), z.object({ b: stringToBigInt })),
  ];
  const outputs = [[1n], [1n, 2n], new Set([1n]), 1n, 1n, 1n, 1n, 1n, 1n, 1n, 1n, { a: 1n, b: 2n }];
  const inputs = [["1"], ["1", "2"], new Set(["1"]), "1", "1", "1", "1", "1", "1", "1", "1", { a: "1", b: "2" }];
  wrappers.forEach((schema, index) => {
    expect(z.output(schema).safeParse(outputs[index]).success).toBe(true);
    expect(z.input(schema).safeParse(inputs[index]).success).toBe(true);
  });
  const preprocess = z.preprocess((value) => value, object);
  expect(z.deepPartial(preprocess)).toBeInstanceOf(z.ZodPreprocess);
  expect(z.output(preprocess)).toBe(object);
  const transformed = z.string().transform((value) => value.length);
  expect(z.deepPartial(transformed)).toBe(transformed);
  expect(z.input(transformed).parse("a")).toBe("a");
  expect(z.output(transformed).parse("a")).toBe(1);
});
