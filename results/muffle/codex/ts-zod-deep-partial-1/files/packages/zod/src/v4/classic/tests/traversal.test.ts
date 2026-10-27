import { expect, test } from "vitest";
import { visit } from "../../core/visit.js";
import * as mini from "../../mini/index.js";
import * as z from "../index.js";

test("visit preserves identity and visits shared nodes once", () => {
  const inner = z.object({ value: z.string() });
  const root = z.object({ x: inner, y: inner });
  let count = 0;
  expect(
    visit(root, (s) => {
      count++;
      return s;
    })
  ).toBe(root);
  expect(count).toBe(3);
  const changed = visit(root, { string: () => z.number() }) as typeof root;
  expect(changed.shape.x).toBe(changed.shape.y);
  expect(changed.parse({ x: { value: 1 }, y: { value: 2 } })).toEqual({ x: { value: 1 }, y: { value: 2 } });
});

test("deepPartial supports recursive getters and cached lazy schemas", () => {
  const Node = z.object({
    name: z.string().min(1),
    get children() {
      return z.array(Node);
    },
  });
  const partial = z.deepPartial(Node);
  expect(partial.parse({ children: [{ children: [{}] }] })).toEqual({ children: [{ children: [{}] }] });
  expect(partial.safeParse({ name: "" }).success).toBe(false);
  expect(Node.safeParse({}).success).toBe(false);
  partial.extend({ extra: z.string() });
  partial.keyof();
  const Lazy: z.ZodLazy<z.ZodType> = z.lazy(() => z.object({ name: z.string(), child: Lazy.optional() }));
  Lazy.parse({ name: "a" });
  expect(z.deepPartial(Lazy).parse({ child: {} })).toEqual({ child: {} });
});

test("projection reaches codecs and preserves schemas without pipes", () => {
  const codec = z.codec(z.string(), z.bigint(), { decode: BigInt, encode: String });
  const schema = z.object({ value: codec, map: z.map(z.string(), codec) });
  expect(z.output(schema).parse({ value: 1n, map: new Map([["a", 2n]]) }).value).toBe(1n);
  expect(z.input(schema).parse({ value: "1", map: new Map() }).value).toBe("1");
  const plain = z.object({ a: z.string() });
  expect(z.output(plain)).toBe(plain);
});

test("mini helpers and discriminated unions", () => {
  const schema = mini.object({ nested: mini.object({ a: mini.string() }) });
  expect(mini.deepPartial(schema).parse({ nested: {} })).toEqual({ nested: {} });
  const du = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("a"), n: z.number() }),
    z.object({ kind: z.literal("b") }),
  ]);
  expect(z.deepPartial(du).parse({})).toEqual({});
});

test("deepPartial traverses collections, wrappers and preserves codec constructors", async () => {
  const object = z.object({ required: z.string() });
  const schema = z.object({
    tuple: z.tuple([object]).rest(object),
    record: z.record(z.string(), object),
    map: z.map(z.string(), object),
    set: z.set(object),
    wrapped: object.optional().nullable().readonly(),
    loose: z.object({}).catchall(object),
    intersection: z.intersection(object, z.object({ other: z.number() })),
  });
  const partial = z.deepPartial(schema);
  expect(
    partial.safeParse({
      tuple: [{}],
      record: { a: {} },
      map: new Map([["a", {}]]),
      set: new Set([{}]),
      wrapped: {},
      loose: { a: {} },
      intersection: {},
    }).success
  ).toBe(true);
  expect(partial.safeParse({ tuple: [] }).success).toBe(false);
  expect(await z.deepPartial(z.promise(object)).parseAsync(Promise.resolve({}))).toEqual({});
  const codec = z.codec(object, object, { decode: (x) => x, encode: (x) => x });
  const result = z.deepPartial(codec);
  expect(result instanceof z.ZodCodec).toBe(true);
  expect(result.parse({})).toEqual({});
  const preprocess = z.preprocess((x) => x, object);
  expect(z.deepPartial(preprocess).parse({})).toEqual({});
});

test("recursive traversal runs callbacks only during traversal", () => {
  const Node = z.object({
    get children() {
      return z.array(Node);
    },
  });
  let calls = 0;
  const rewritten = visit(Node, (s) => {
    calls++;
    return s._zod.def.type === "object"
      ? z.object({ children: (s as z.ZodObject).shape.children, tag: z.string().optional() })
      : s;
  });
  expect(calls).toBe(2);
  z.parse(rewritten, { children: [{ children: [], tag: "nested" }] });
  expect(calls).toBe(2);
});

test("visit leaves unknown kinds alone and preserves untouched siblings", () => {
  const untouched = z.string().min(1);
  const root = z.object({ untouched, changed: z.number() }).strict();
  const result = visit(root, { number: () => z.boolean() }) as typeof root;
  expect(result.shape.untouched).toBe(untouched);
  expect(result.safeParse({ untouched: "ok", changed: true, extra: 1 }).success).toBe(false);
  const custom = z.string();
  (custom._zod.def as { type: string }).type = "external";
  let calls = 0;
  expect(
    visit(custom, (s) => {
      calls++;
      return s;
    })
  ).toBe(custom);
  expect(calls).toBe(0);
});
