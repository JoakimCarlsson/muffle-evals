import { expect, test } from "vitest";
import * as z from "zod/v4";
import { visit } from "../../core/visit.js";

test("visit: identity and shared nodes", () => {
  const inner = z.object({ a: z.string() });
  const s = z.object({ x: inner, y: inner });
  let n = 0;
  expect(
    visit(s, (n_) => {
      n++;
      return n_;
    }),
  ).toBe(s);
  expect(n).toBe(3);
});

test("visit: custom schema untouched, handler map", () => {
  const c = z.custom<number>(() => true);
  expect(visit(c, { number: () => z.string() })).toBe(c);
  const s = z.object({ a: z.number(), b: z.string() });
  const r = visit(s, { number: () => z.string() }) as typeof s;
  expect(r.shape.b).toBe(s.shape.b);
  expect(r.parse({ a: "x", b: "y" })).toEqual({ a: "x", b: "y" });
});

test("visit: lazy recursion, resolved lazy, getters", () => {
  type T = { c?: T[]; n: number };
  const L: z.ZodType<T> = z.object({
    n: z.number(),
    c: z.lazy(() => z.array(L)).optional(),
  }) as any;
  L.parse({ n: 1, c: [{ n: 2 }] });
  const calls: string[] = [];
  const r = visit(L, (s) => {
    calls.push(s._zod.def.type);
    return s._zod.def.type === "number" ? z.string() : s;
  }) as z.ZodType;
  const before = calls.length;
  expect(r.parse({ n: "1", c: [{ n: "2" }] })).toEqual({
    n: "1",
    c: [{ n: "2" }],
  });
  expect(() => r.parse({ n: 1 })).toThrow();
  expect(calls.length).toBe(before);

  const Node = z.object({
    n: z.number(),
    get children() {
      return z.array(Node);
    },
  });
  const r2 = visit(Node, { number: () => z.string() }) as any;
  expect(
    r2.parse({ n: "a", children: [{ n: "b", children: [] }] }),
  ).toBeTruthy();
  expect(() =>
    r2.parse({ n: "a", children: [{ n: 1, children: [] }] }),
  ).toThrow();
  expect(visit(Node, (s) => s)).toBe(Node);
});

test("deepPartial", () => {
  const Node = z.object({
    a: z.string().min(1),
    get kids() {
      return z.array(Node);
    },
  });
  const s = z.object({
    o: z.object({ x: z.number() }),
    t: z.tuple([z.object({ x: z.number() })], z.object({ y: z.number() })),
    r: z.record(z.string(), z.object({ x: z.number() })),
    m: z.map(z.string(), z.object({ x: z.number() })),
    d: z.discriminatedUnion("k", [
      z.object({ k: z.literal("a"), v: z.number() }),
    ]),
    node: Node,
    pre: z.preprocess((v) => v, z.object({ x: z.number() })),
  });
  const p = z.deepPartial(s);
  expect(p.parse({})).toEqual({});
  expect(
    p.parse({
      o: {},
      t: [{}, {}],
      r: { a: {} },
      d: {},
      node: { kids: [{ kids: [] }] },
    }),
  ).toBeTruthy();
  expect(() => p.parse({ node: { a: "" } })).toThrow();
  expect(() => p.parse({ t: [] })).toThrow();
  expect(p.shape.o).toBeInstanceOf(z.ZodOptional);
  expect(p.shape.pre.unwrap()).toBeInstanceOf(z.ZodPreprocess);
  expect(() => s.shape.o.parse({})).toThrow();
  expect(z.deepPartial(z.string())).toBeInstanceOf(z.ZodString);
});

test("input / output", () => {
  const c = z.codec(z.number(), z.bigint(), {
    decode: (n) => BigInt(n),
    encode: (b) => Number(b),
  });
  const s = z.object({ b: c, l: z.array(c) });
  expect(z.output(s).parse({ b: 1n, l: [2n] })).toEqual({ b: 1n, l: [2n] });
  expect(z.input(s).parse({ b: 1, l: [2] })).toEqual({ b: 1, l: [2] });
  const plain = z.object({ a: z.string() });
  expect(z.input(plain)).toBe(plain);
  expect(z.output(plain)).toBe(plain);
});
