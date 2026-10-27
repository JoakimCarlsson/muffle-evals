import { expect, test, vi } from "vitest";
import * as z from "zod/v4";
import { visit } from "../visit.js";

test("untouched schema is returned as is", () => {
  const s = z.object({ a: z.array(z.string()), b: z.record(z.string(), z.number()) });
  expect(visit(s, (x) => x)).toBe(s);
  expect(visit(s, {})).toBe(s);
});

test("shared nodes are visited once", () => {
  const inner = z.object({ v: z.string() });
  const s = z.object({ x: inner, y: inner });
  const cb = vi.fn((x: z.core.$ZodType) => x);
  visit(s, cb);
  expect(cb).toHaveBeenCalledTimes(3);
});

test("handler map rewrites by def.type and keeps identity of untouched siblings", () => {
  const sib = z.object({ s: z.string() });
  const s = z.object({ n: z.number(), sib, strictish: z.array(z.number()) }).strict();
  const out = visit(s, { number: () => z.string() }) as typeof s;
  expect(out).not.toBe(s);
  expect(out.shape.sib).toBe(sib);
  expect(out.shape.n._zod.def.type).toBe("string");
  expect(out.safeParse({ n: "a", sib: { s: "x" }, strictish: ["q"], extra: 1 }).success).toBe(false);
  expect(s.shape.n._zod.def.type).toBe("number");
});

test("unknown def.type is untouched", () => {
  const custom = z.custom<string>((v) => typeof v === "string");
  expect(visit(custom, {})).toBe(custom);
});

test("codec and preprocess keep their kind", () => {
  const codec = z.codec(z.string(), z.number(), { decode: (s) => Number(s), encode: (n) => String(n) });
  const pre = z.preprocess((v) => v, z.number());
  const out = visit(z.object({ codec, pre }), { number: () => z.number().min(1) }) as any;
  expect(out.shape.codec).toBeInstanceOf(z.ZodCodec);
  expect(out.shape.codec.def.transform).toBe(codec.def.transform);
  expect(out.shape.pre.def.in.def.type).toBe("transform");
});

test("lazy recursion: identity and rewrite", () => {
  type Cat = { name: string; kids: Cat[] };
  const Cat: z.ZodType<Cat> = z.object({ name: z.string(), kids: z.array(z.lazy(() => Cat)) });
  Cat.parse({ name: "a", kids: [] });
  expect(visit(Cat, (x) => x)).toBe(Cat);

  const cb = vi.fn((x: z.core.$ZodType) => (x._zod.def.type === "string" ? z.string().min(2) : x));
  const out = visit(Cat, cb) as z.ZodType<Cat>;
  const calls = cb.mock.calls.length;
  expect(out).not.toBe(Cat);
  expect(out.safeParse({ name: "ab", kids: [{ name: "cd", kids: [] }] }).success).toBe(true);
  expect(out.safeParse({ name: "ab", kids: [{ name: "c", kids: [] }] }).success).toBe(false);
  expect(cb).toHaveBeenCalledTimes(calls);
});

test("getter recursion", () => {
  const Node = z.object({
    name: z.string(),
    get children() {
      return z.array(Node);
    },
  });
  expect(visit(Node, (x) => x)).toBe(Node);
  const cb = vi.fn((x: z.core.$ZodType) => (x._zod.def.type === "string" ? z.string().min(2) : x));
  const out = visit(Node, cb) as any;
  const calls = cb.mock.calls.length;
  expect(out.safeParse({ name: "ab", children: [{ name: "x", children: [] }] }).success).toBe(false);
  expect(out.safeParse({ name: "ab", children: [{ name: "xy", children: [] }] }).success).toBe(true);
  expect(cb).toHaveBeenCalledTimes(calls);
});

test("lazy with already resolved inner is rewritten", () => {
  const l = z.lazy(() => z.number());
  l.parse(1);
  const out = visit(l, { number: () => z.string() }) as z.ZodType;
  expect(out.safeParse("a").success).toBe(true);
  expect(out.safeParse(1).success).toBe(false);
});
