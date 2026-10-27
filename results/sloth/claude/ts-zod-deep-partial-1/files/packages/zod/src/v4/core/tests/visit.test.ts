import { expect, test, vi } from "vitest";
import * as z from "zod/v4";
import { visit } from "../visit.js";

test("untouched schema keeps identity", () => {
  const s = z.object({ a: z.array(z.string()), b: z.record(z.string(), z.number()) });
  expect(visit(s, (x) => x)).toBe(s);
});

test("shared nodes are visited once", () => {
  const inner = z.object({ v: z.string() });
  const fn = vi.fn((s: z.core.$ZodType) => s);
  visit(z.object({ x: inner, y: inner }), fn);
  expect(fn).toHaveBeenCalledTimes(3);
});

test("handler map, siblings keep identity, object keeps strict", () => {
  const untouched = z.string();
  const s = z.strictObject({ a: z.number(), b: untouched, c: z.tuple([z.number()], z.number()) });
  const r = visit(s, { number: () => z.string() }) as typeof s;
  expect(r).not.toBe(s);
  expect(r.shape.b).toBe(untouched);
  expect(r.parse({ a: "x", b: "y", c: ["a", "b"] })).toEqual({ a: "x", b: "y", c: ["a", "b"] });
  expect(z.safeParse(r, { a: "x", b: "y", c: ["a"], d: 1 }).success).toBe(false);
});

test("unknown def type is untouched", () => {
  const custom = { _zod: { def: { type: "weird" } } } as any;
  const fn = vi.fn(() => z.string());
  expect(visit(custom, fn)).toBe(custom);
  const s = z.array(custom);
  expect(visit(s, (x) => x)).toBe(s);
});

test("lazy recursion", () => {
  const Node: z.ZodType<any> = z.object({ n: z.number(), kids: z.array(z.lazy(() => Node)) });
  Node.parse({ n: 1, kids: [] });
  const fn = vi.fn((s: z.core.$ZodType) => (s._zod.def.type === "number" ? z.string() : s));
  const r = visit(Node, fn);
  const calls = fn.mock.calls.length;
  expect(z.safeParse(r, { n: "a", kids: [{ n: "b", kids: [] }] }).success).toBe(true);
  expect(z.safeParse(r, { n: "a", kids: [{ n: 1, kids: [] }] }).success).toBe(false);
  expect(fn).toHaveBeenCalledTimes(calls);
  expect(visit(Node, (x) => x)).toBe(Node);
});

test("getter recursion", () => {
  const Node = z.object({
    n: z.number(),
    get children() {
      return z.array(Node);
    },
  });
  expect(visit(Node, (x) => x)).toBe(Node);
  const fn = vi.fn((s: z.core.$ZodType) => (s._zod.def.type === "number" ? z.string() : s));
  const r = visit(Node, fn) as any;
  const calls = fn.mock.calls.length;
  expect(z.safeParse(r, { n: "a", children: [{ n: "b", children: [] }] }).success).toBe(true);
  expect(z.safeParse(r, { n: "a", children: [{ n: 1, children: [] }] }).success).toBe(false);
  expect(fn).toHaveBeenCalledTimes(calls);
});

test("direct getter self reference", () => {
  const Node = z.object({
    n: z.number(),
    get next() {
      return Node.optional();
    },
  });
  const r = visit(Node, { number: () => z.string() }) as any;
  expect(z.safeParse(r, { n: "a", next: { n: "b" } }).success).toBe(true);
  expect(z.safeParse(r, { n: "a", next: { n: 1 } }).success).toBe(false);
});

test("lazy already resolved by earlier parse is still rewritten", () => {
  const l = z.lazy(() => z.number());
  l.parse(1);
  const r = visit(l, { number: () => z.string() });
  expect(z.safeParse(r, "a").success).toBe(true);
  expect(z.safeParse(r, 1).success).toBe(false);
});

test("pipes keep their kind", () => {
  const codec = z.codec(z.string(), z.number(), { decode: Number, encode: String });
  const r = visit(z.object({ c: codec }), { number: (s) => s }) as any;
  expect(r).not.toBeUndefined();
  const pre = z.preprocess((v) => v, z.number());
  const r2 = visit(pre, { number: () => z.string() }) as any;
  expect(r2._zod.def.type).toBe("pipe");
  expect(z.safeParse(r2, "a").success).toBe(true);
  const c2 = visit(codec, { number: () => z.bigint() }) as any;
  expect(typeof c2._zod.def.transform).toBe("function");
});
