import { expect, test } from "vitest";
import * as z from "../index.js";
import * as mini from "../../mini/index.js";
import { visit } from "../../core/visit.js";

test("identity, sharing, handler dispatch and custom nodes", () => {
  const inner = z.object({ a: z.string() });
  const root = z.object({ x: inner, y: inner });
  let calls = 0;
  expect(
    visit(root, (s) => {
      calls++;
      return s;
    })
  ).toBe(root);
  expect(calls).toBe(3);
  const changed = visit(root, { string: () => z.number() }) as typeof root;
  expect(changed.shape.x).toBe(changed.shape.y);
  expect(changed.parse({ x: { a: 1 }, y: { a: 2 } })).toEqual({ x: { a: 1 }, y: { a: 2 } });
});

test("recursive objects and already resolved lazy schemas", () => {
  const Node = z.object({
    name: z.string(),
    get children() {
      return z.array(Node);
    },
  });
  expect(visit(Node, (s) => s)).toBe(Node);
  const partial = z.deepPartial(Node);
  expect(partial.parse({ children: [{ children: [{}] }] })).toEqual({ children: [{ children: [{}] }] });
  expect(Node.safeParse({}).success).toBe(false);
  const Lazy: z.ZodLazy<z.ZodObject<any>> = z.lazy(() => z.object({ name: z.string(), children: z.array(Lazy) }));
  Lazy.parse({ name: "a", children: [] });
  expect(z.deepPartial(Lazy).parse({ children: [{}] })).toEqual({ children: [{}] });
});

test("deep partial containers, discriminators, checks and mini", () => {
  const obj = z.object({ a: z.string().min(1) });
  const schema = z.object({
    tuple: z.tuple([obj]).rest(obj),
    record: z.record(z.string(), obj),
    map: z.map(z.string(), obj),
    set: z.set(obj),
    du: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("a"), a: obj }),
      z.object({ kind: z.literal("b"), b: obj }),
    ]),
  });
  const partial = z.deepPartial(schema);
  expect(
    partial.parse({ tuple: [{}, {}], record: { a: {} }, map: new Map([["a", {}]]), set: new Set([{}]), du: {} }).du
  ).toEqual({});
  expect(partial.safeParse({ tuple: [] }).success).toBe(false);
  expect(z.deepPartial(obj).safeParse({ a: "" }).success).toBe(false);
  expect(mini.deepPartial(mini.object({ a: mini.object({ b: mini.string() }) })).parse({ a: {} })).toEqual({ a: {} });
  partial.extend({ another: z.string() });
  partial.keyof();
});

test("nested input/output, codec and preprocess preservation", () => {
  const codec = z.codec(z.string(), z.bigint(), { decode: BigInt, encode: String });
  const schema = z.object({ b: codec, record: z.record(z.string(), codec), map: z.map(z.string(), codec) });
  expect(z.output(schema).parse({ b: 1n, record: { a: 2n }, map: new Map([["a", 3n]]) }).b).toBe(1n);
  expect(z.input(schema).parse({ b: "1", record: {}, map: new Map() }).b).toBe("1");
  const plain = z.object({ a: z.string() });
  expect(z.output(plain)).toBe(plain);
  const partial = z.deepPartial(
    z.codec(z.object({ a: z.string() }), z.object({ b: z.string() }), {
      decode: () => ({ b: "ok" }),
      encode: () => ({ a: "ok" }),
    })
  );
  expect(partial._zod.def).toHaveProperty("transform");
  expect(partial.parse({})).toEqual({ b: "ok" });
  expect(z.deepPartial(z.preprocess((v) => v, plain)).parse({})).toEqual({});
});

test("wrappers, catchalls, functions and recursive projections", async () => {
  const obj = z.object({ a: z.string() });
  for (const wrapped of [
    obj.optional(),
    obj.nullable(),
    obj.default({ a: "x" }),
    obj.prefault({ a: "x" }),
    obj.nonoptional(),
    obj.catch({ a: "x" }),
    obj.readonly(),
  ]) {
    expect(z.deepPartial(wrapped).parse({})).toEqual({});
  }
  expect(await z.deepPartial(z.promise(obj)).parseAsync(Promise.resolve({}))).toEqual({});
  expect(z.deepPartial(z.success(obj)).parse({})).toBe(true);
  expect(z.deepPartial(z.intersection(obj, z.object({ b: z.number() }))).parse({})).toEqual({});
  expect(z.deepPartial(z.object({}).catchall(obj)).parse({ extra: {} })).toEqual({ extra: {} });
  expect(z.deepPartial(z.strictObject({ a: z.string() })).safeParse({ extra: 1 }).success).toBe(false);
  expect(z.deepPartial(z.looseObject({ a: z.string() })).parse({ extra: 1 })).toEqual({ extra: 1 });
  const fn = z.deepPartial(z.function({ input: [obj], output: obj }));
  expect(fn.implement((v) => v)({})).toEqual({});
  const codec = z.codec(z.string(), z.bigint(), { decode: BigInt, encode: String });
  const Node = z.object({
    value: codec,
    get children() {
      return z.array(Node);
    },
  });
  expect(z.output(Node).parse({ value: 1n, children: [{ value: 2n, children: [] }] }).value).toBe(1n);
  const MiniNode = mini.object({
    a: mini.string(),
    get children() {
      return mini.array(MiniNode);
    },
  });
  expect(mini.deepPartial(MiniNode).parse({ children: [{}] })).toEqual({ children: [{}] });
  let calls = 0;
  const changed = visit(Node, (node) => {
    calls++;
    return node._zod.def.type === "pipe" ? (node._zod.def as any).out : node;
  }) as z.ZodType;
  const before = calls;
  changed.parse({ value: 1n, children: [] });
  expect(calls).toBe(before);
});
