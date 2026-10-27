import { expect, expectTypeOf, test } from "vitest";
import * as z from "zod";
import * as mini from "zod/mini";
import * as core from "../../core/index.js";
import { visit } from "../../core/visit.js";

test("visit preserves identity, shares rewrites, and dispatches handlers", () => {
  const inner = z.object({ name: z.string() });
  const schema = z.object({ x: inner, y: inner, untouched: z.number() });
  const seen: core.$ZodType[] = [];
  expect(
    visit(schema, (node) => {
      seen.push(node);
      return node;
    })
  ).toBe(schema);
  expect(seen).toHaveLength(4);
  const result = visit(schema, { string: () => z.number() }) as typeof schema;
  expect(result.shape.x).toBe(result.shape.y);
  expect(result.shape.untouched).toBe(schema.shape.untouched);
  expect(result.parse({ x: { name: 1 }, y: { name: 2 }, untouched: 3 })).toBeTruthy();
  const custom = new core.$ZodType({ type: "unrecognized" } as any);
  expect(
    visit(custom, () => {
      throw new Error("unreachable");
    })
  ).toBe(custom);
});

for (const api of [z, mini as unknown as typeof z]) {
  test(`${api === z ? "classic" : "mini"} deepPartial containers and wrappers`, async () => {
    const obj = api.object({ name: api.string() });
    const values = [
      [api.array(obj), [{}]],
      [api.tuple([obj], obj), [{}, {}]],
      [api.record(api.string(), obj), { a: {} }],
      [api.map(api.string(), obj), new Map([["a", {}]])],
      [api.set(obj), new Set([{}])],
      [api.union([obj, api.number()]), {}],
      [api.intersection(obj, api.object({ age: api.number() })), {}],
      [api.optional(obj), {}],
      [api.nullable(obj), {}],
      [api._default(obj, { name: "a" }), {}],
      [api.prefault(obj, { name: "a" }), {}],
      [api.nonoptional(api.optional(obj)), {}],
      [api.catch(obj, { name: "a" }), {}],
      [api.readonly(obj), {}],
      [api.promise(obj), Promise.resolve({})],
      [api.success(obj), {}],
      [api.pipe(obj, obj), {}],
      [api === z ? z.object({}).catchall(obj) : mini.catchall(mini.object({}), obj), { extra: {} }],
    ] as const;
    for (const [schema, value] of values) {
      expect((await api.deepPartial(schema).safeParseAsync(value)).success).toBe(true);
    }
    expect(api.deepPartial(api.tuple([obj])).safeParse([]).success).toBe(false);
    expect(api.deepPartial(api.string().check(api.minLength(1))).safeParse("").success).toBe(false);
    expect(obj.safeParse({}).success).toBe(false);
    expect(api.deepPartial(api.strictObject({ name: api.string() })).safeParse({ extra: 1 }).success).toBe(false);
    expect(api.deepPartial(api.looseObject({ name: api.string() })).parse({ extra: 1 })).toEqual({ extra: 1 });
    const du = api.discriminatedUnion("kind", [
      api.object({ kind: api.literal("a"), value: obj }),
      api.object({ kind: api.literal("b") }),
    ]);
    const partial = api.deepPartial(du);
    expect(partial._zod.def.type).toBe("union");
    expect(partial.parse({ value: {} })).toEqual({ value: {} });
  });

  test(`${api === z ? "classic" : "mini"} nested input and output and codecs`, () => {
    const codec = api.codec(api.string(), api.bigint(), { decode: BigInt, encode: String });
    const schema = api.object({ b: codec, record: api.record(api.string(), codec), map: api.map(api.string(), codec) });
    expect(api.output(schema).parse({ b: 1n, record: { x: 2n }, map: new Map([["x", 3n]]) }).b).toBe(1n);
    expect(api.input(schema).parse({ b: "1", record: { x: "2" }, map: new Map([["x", "3"]]) }).b).toBe("1");
    const untouched = api.object({ name: api.string() });
    expect(api.input(untouched)).toBe(untouched);
    expect(api.output(untouched)).toBe(untouched);
    const objectCodec = api.codec(untouched, untouched, { decode: (x) => x, encode: (x) => x });
    const partial = api.deepPartial(objectCodec);
    expect(partial._zod.constr).toBe(objectCodec._zod.constr);
    expect(partial.parse({})).toEqual({});
    expect(core.encode(partial, {})).toEqual({});
  });
}

test("recursive getters and previously resolved lazies", () => {
  const Node = z.object({
    name: z.string(),
    get children() {
      return z.array(Node);
    },
  });
  const partial = z.deepPartial(Node);
  expect(partial.parse({ children: [{ children: [{}] }] })).toEqual({ children: [{ children: [{}] }] });
  expect(visit(Node, (node) => node)).toBe(Node);
  const Lazy: z.ZodType = z.lazy(() => z.object({ name: z.string(), children: z.array(Lazy) }));
  Lazy.parse({ name: "a", children: [] });
  const lazyPartial = z.deepPartial(Lazy);
  expect(lazyPartial.parse({ children: [{}] })).toEqual({ children: [{}] });
  let calls = 0;
  const rewritten = visit(Node, (node) => {
    calls++;
    return node;
  }) as typeof Node;
  const before = calls;
  rewritten.parse({ name: "a", children: [] });
  expect(calls).toBe(before);
});

test("structural types and preprocess identity", () => {
  const schema = z.deepPartial(z.object({ nested: z.object({ name: z.string() }) }));
  expectTypeOf(schema.shape.nested).toEqualTypeOf<z.ZodOptional<z.ZodObject<{ name: z.ZodOptional<z.ZodString> }>>>();
  expect(schema.extend({ extra: z.number() }).parse({ extra: 1 })).toEqual({ extra: 1 });
  expect(schema.keyof().parse("nested")).toBe("nested");
  const small = mini.deepPartial(mini.object({ name: mini.string() }));
  expectTypeOf(small.shape.name).toEqualTypeOf<mini.ZodMiniOptional<mini.ZodMiniString<string>>>();
  const preprocess = z.preprocess((x) => x, z.object({ name: z.string() }));
  const result = z.deepPartial(preprocess);
  expect(result._zod.constr).toBe(preprocess._zod.constr);
  expect(result.parse({})).toEqual({});
});

test("visitor invokes the callback once per shared node, after its children", () => {
  const leaf = z.string();
  const inner = z.object({ name: leaf });
  const root = z.object({ x: inner, y: inner });
  const seen: core.$ZodType[] = [];
  visit(root, (node) => {
    seen.push(node);
    return node;
  });
  expect(seen).toEqual([leaf, inner, root]);
  const transformed = z.transform((value) => value);
  expect(z.deepPartial(transformed)).toBe(transformed);
  const checked = z.string().min(1);
  expect(z.deepPartial(checked)).toBe(checked);
  expect(z.deepPartial(checked).safeParse("").success).toBe(false);
});

test("visitor reaches function arguments and return types", () => {
  const schema = z.function({ input: [z.object({ name: z.string() })], output: z.object({ name: z.string() }) });
  const partial = z.deepPartial(schema);
  expect((partial._zod.def as any).input.parse([{}])).toEqual([{}]);
  expect((partial._zod.def as any).output.parse({})).toEqual({});
});

test("rewrites retain dynamic defaults without evaluating them", () => {
  let defaults = 0;
  const schema = z.object({ name: z.string() }).default(() => ({ name: String(++defaults) }));
  const result = z.deepPartial(schema);
  expect(defaults).toBe(0);
  expect(result.parse(undefined)).toEqual({ name: "1" });
  expect(result.parse(undefined)).toEqual({ name: "2" });
});

test("mini recursive objects and resolved lazies", () => {
  const Node = mini.object({
    name: mini.string(),
    get children() {
      return mini.array(Node);
    },
  });
  const partial = mini.deepPartial(Node);
  expect(partial.parse({ children: [{}] })).toEqual({ children: [{}] });
  const Lazy: mini.ZodMiniType = mini.lazy(() => mini.object({ name: mini.string(), children: mini.array(Lazy) }));
  Lazy.parse({ name: "a", children: [] });
  expect(mini.deepPartial(Lazy).parse({ children: [{}] })).toEqual({ children: [{}] });
});

for (const api of [z, mini as unknown as typeof z]) {
  test(`${api === z ? "classic" : "mini"} projections traverse all container positions`, async () => {
    const codec = api.codec(api.string(), api.bigint(), { decode: BigInt, encode: String });
    const schemas = [
      [api.array(codec), ["1"], [1n]],
      [api.tuple([codec], codec), ["1", "2"], [1n, 2n]],
      [api.map(codec, codec), new Map([["1", "2"]]), new Map([[1n, 2n]])],
      [api.set(codec), new Set(["1"]), new Set([1n])],
      [api.union([codec, api.boolean()]), "1", 1n],
      [api.intersection(api.object({ x: codec }), api.object({ y: codec })), { x: "1", y: "2" }, { x: 1n, y: 2n }],
      [api.optional(codec), "1", 1n],
      [api.nullable(codec), "1", 1n],
      [api._default(codec, 1n), "1", 1n],
      [api.prefault(codec, "1"), "1", 1n],
      [api.nonoptional(api.optional(codec)), "1", 1n],
      [api.catch(codec, 1n), "1", 1n],
      [api.readonly(codec), "1", 1n],
      [api.promise(codec), Promise.resolve("1"), Promise.resolve(1n)],
      [api.success(codec), "1", 1n],
      [api.lazy(() => codec), "1", 1n],
      [api === z ? z.object({}).catchall(codec) : mini.catchall(mini.object({}), codec), { x: "1" }, { x: 1n }],
    ] as const;
    for (const [schema, input, output] of schemas) {
      expect((await api.input(schema).safeParseAsync(input)).success).toBe(true);
      expect((await api.output(schema).safeParseAsync(output)).success).toBe(true);
    }
    const Node = api.object({
      b: codec,
      get children() {
        return api.array(Node);
      },
    });
    expect(api.output(Node).parse({ b: 1n, children: [{ b: 2n, children: [] }] })).toEqual({
      b: 1n,
      children: [{ b: 2n, children: [] }],
    });
  });
}
