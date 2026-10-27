import { expect, expectTypeOf, test } from "vitest";
import { visit } from "../../core/visit.js";
import * as mini from "../../mini/index.js";
import * as z from "../index.js";

test("visit preserves sharing and only clones changed ancestors", () => {
  const inner = z.array(z.string());
  const schema = z.object({ x: inner, y: inner, n: z.number() });
  const seen: unknown[] = [];
  expect(
    visit(schema, (s) => {
      seen.push(s);
      return s;
    })
  ).toBe(schema);
  expect(seen).toHaveLength(4);
  const changed = visit(schema, { string: () => z.boolean() }) as typeof schema;
  expect(changed.shape.x).toBe(changed.shape.y);
  expect(changed.shape.n).toBe(schema.shape.n);
});

for (const [name, implementation] of [
  ["classic", z],
  ["mini", mini],
] as const) {
  const api = implementation as typeof z;
  test(`${name}: deepPartial traverses containers and retains checks`, () => {
    const item = api.object({ name: api.string(), nested: api.object({ n: api.number() }) });
    const schema = api.object({
      array: api.array(item),
      tuple: api.tuple([item]),
      record: api.record(api.string(), item),
      map: api.map(api.string(), item),
      set: api.set(item),
    });
    const partial = api.deepPartial(schema);
    expect(
      partial.parse({ array: [{}], tuple: [{}], record: { a: {} }, map: new Map([["a", {}]]), set: new Set([{}]) })
    ).toBeTruthy();
    expect(partial.safeParse({ tuple: [] }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
    expect(api.deepPartial(api.string())).toBeDefined();
  });
  test(`${name}: nested codecs and pipe-free identity`, () => {
    const codec = api.codec(api.string(), api.bigint(), { decode: BigInt, encode: String });
    const schema = api.object({ b: codec, r: api.record(api.string(), codec), m: api.map(api.string(), codec) });
    expect(api.output(schema).parse({ b: 1n, r: { a: 2n }, m: new Map([["a", 3n]]) })).toBeTruthy();
    expect(api.input(schema).parse({ b: "1", r: { a: "2" }, m: new Map([["a", "3"]]) })).toBeTruthy();
    const plain = api.object({ x: api.string() });
    expect(api.input(plain)).toBe(plain);
    expect(api.output(plain)).toBe(plain);
    expect(api.deepPartial(api.object({ codec })).shape.codec._zod.def.innerType._zod.def.type).toBe("pipe");
  });
}

test("recursive getters are resolved during traversal", () => {
  const Node = z.object({
    value: z.string(),
    get children(): z.ZodArray<typeof Node> {
      return z.array(Node);
    },
  });
  const partial = z.deepPartial(Node);
  expect(partial.parse({ children: [{ children: [{}] }] })).toEqual({ children: [{ children: [{}] }] });
  let calls = 0;
  const visited = visit(Node, (s) => {
    calls++;
    return s;
  });
  const before = calls;
  expect(visited).toBe(Node);
  z.parse(visited, { value: "a", children: [] });
  expect(calls).toBe(before);
  expectTypeOf(partial.shape.value).toEqualTypeOf<z.ZodOptional<z.ZodString>>();
  partial.extend({ extra: z.string() }).keyof();
});

test("cached recursive lazy is rewritten", () => {
  const Node: z.ZodType<{ value: string; children: any[] }> = z.lazy(() =>
    z.object({ value: z.string(), children: z.array(Node) })
  );
  Node.parse({ value: "a", children: [] });
  const partial = z.deepPartial(Node);
  expect(partial.parse({ children: [{}] })).toEqual({ children: [{}] });
});

test("discriminated unions become ordinary unions; checks and codecs survive", () => {
  const schema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("a"), a: z.string() }),
    z.object({ kind: z.literal("b"), b: z.number() }),
  ]);
  const partial = z.deepPartial(schema);
  expect(partial._zod.def).not.toHaveProperty("discriminator");
  expect(partial.parse({})).toEqual({});
  expect(z.deepPartial(z.string().min(1)).safeParse("").success).toBe(false);
  const codec = z.codec(z.object({ a: z.string() }), z.object({ b: z.string() }), {
    decode: (v) => ({ b: v.a }),
    encode: (v) => ({ a: v.b }),
  });
  expect(z.deepPartial(codec)).toBeInstanceOf(z.ZodCodec);
  expect(z.deepPartial(z.preprocess((v) => v, z.object({ a: z.string() })))).toBeInstanceOf(z.ZodPreprocess);
});

test("wrappers, rest items, catchalls, and functions are traversed", async () => {
  const item = z.object({ n: z.number() });
  for (const wrapper of [
    item.optional(),
    item.nullable(),
    item.default({ n: 1 }),
    item.prefault({ n: 1 }),
    item.catch({ n: 1 }),
    item.readonly(),
    item.nonoptional(),
  ]) {
    expect(z.deepPartial(wrapper).parse({})).toEqual({});
  }
  await expect(z.deepPartial(z.promise(item)).parseAsync(Promise.resolve({}))).resolves.toEqual({});
  expect(z.deepPartial(z.success(item)).parse({})).toBe(true);
  expect(z.deepPartial(z.tuple([z.string()], item)).parse(["a", {}])).toEqual(["a", {}]);
  expect(z.deepPartial(z.intersection(item, z.object({ s: z.string() }))).parse({})).toEqual({});
  expect(z.deepPartial(z.object({}).catchall(item)).parse({ extra: {} })).toEqual({ extra: {} });
  expect(z.deepPartial(z.strictObject({ n: z.number() })).safeParse({ extra: true }).success).toBe(false);
  expect(z.deepPartial(z.looseObject({ n: z.number() })).parse({ extra: true })).toEqual({ extra: true });
  const fn = z.deepPartial(z.function({ input: [item], output: item }));
  expect(fn.implement((value) => value)({})).toEqual({});
  const piped = z.deepPartial(z.pipe(item, item));
  expect(piped.parse({})).toEqual({});
});

test("recursive pipe extraction reaches back references without parse-time callbacks", () => {
  const codec = z.codec(z.string(), z.bigint(), { decode: BigInt, encode: String });
  const Node = z.object({
    b: codec,
    get children(): z.ZodArray<typeof Node> {
      return z.array(Node);
    },
  });
  expect(z.output(Node).parse({ b: 1n, children: [{ b: 2n, children: [] }] })).toEqual({
    b: 1n,
    children: [{ b: 2n, children: [] }],
  });
  let calls = 0;
  const partial = visit(Node, (node) => {
    calls++;
    return node._zod.def.type === "object" ? (node as z.ZodObject).partial() : node;
  });
  const count = calls;
  z.parse(partial, { children: [{}] });
  expect(calls).toBe(count);
});

test("mini preserves structural object types", () => {
  const Node = mini.object({
    value: mini.string(),
    get children(): mini.ZodMiniArray<typeof Node> {
      return mini.array(Node);
    },
  });
  const partial = mini.deepPartial(Node);
  expectTypeOf(partial.shape.value).toEqualTypeOf<mini.ZodMiniOptional<mini.ZodMiniString<string>>>();
  expect(mini.extend(partial, { extra: mini.string() })).toBeDefined();
  expect(mini.keyof(partial).parse("value")).toBe("value");
  expect(partial.parse({ children: [{}] })).toEqual({ children: [{}] });
  const codec = mini.codec(mini.string(), mini.bigint(), { decode: BigInt, encode: String });
  expectTypeOf(mini.output(mini.object({ codec })).shape.codec).toEqualTypeOf<mini.ZodMiniBigInt<bigint>>();
  expectTypeOf(mini.input(mini.object({ codec })).shape.codec).toEqualTypeOf<mini.ZodMiniString<string>>();
});

test("traversal preserves default factories without evaluating them", () => {
  let count = 0;
  const schema = z.object({ n: z.number() }).default(() => ({ n: ++count }));
  const partial = z.deepPartial(schema);
  expect(count).toBe(0);
  expect(partial.parse(undefined)).toEqual({ n: 1 });
  expect(partial.parse(undefined)).toEqual({ n: 2 });
  expect(visit(schema, (node) => node)).toBe(schema);
  expect(count).toBe(2);
});

test("unknown definitions pass through and shared nodes run once", () => {
  const custom = { _zod: { def: { type: "plugin-type", innerType: z.string() } } } as unknown as z.core.$ZodType;
  expect(
    visit(custom, () => {
      throw new Error("unknown node visited");
    })
  ).toBe(custom);
  const inner = z.array(z.string());
  let count = 0;
  const root = z.object({ x: inner, y: inner });
  expect(
    visit(root, (node) => {
      count++;
      return node;
    })
  ).toBe(root);
  expect(count).toBe(3);
  const lazy = z.lazy(() => z.object({ required: z.string() }));
  lazy.parse({ required: "a" });
  expect(z.deepPartial(lazy).parse({})).toEqual({});
});

test("template literal schema parts are traversed", () => {
  const template = z.templateLiteral(["x", z.number()]);
  const rewritten = visit(template, { number: () => z.literal(1) });
  expect(z.safeParse(rewritten, "x1").success).toBe(true);
  expect(z.safeParse(rewritten, "x2").success).toBe(false);
  expect(visit(template, (node) => node)).toBe(template);
});
