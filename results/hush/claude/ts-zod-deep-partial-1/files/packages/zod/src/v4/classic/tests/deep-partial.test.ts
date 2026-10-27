import { expect, expectTypeOf, test, vi } from "vitest";
import * as z from "zod/v4";
import { visit } from "../../core/visit.js";

const codec = z.codec(z.string(), z.bigint(), {
  decode: (s) => BigInt(s),
  encode: (b) => b.toString(),
});

test("visit: identity and call count", () => {
  const inner = z.object({ a: z.string() });
  const root = z.object({ x: inner, y: inner });
  const cb = vi.fn((s: z.core.$ZodType) => s);
  expect(visit(root, cb)).toBe(root);
  expect(cb).toHaveBeenCalledTimes(3);
  const out = visit(z.object({ n: z.number(), s: inner }), { number: () => z.string() }) as any;
  expect(out.shape.n).toBeInstanceOf(z.ZodString);
  expect(out.shape.s).toBe(inner);
});

test("visit: lazy and getter recursion", () => {
  const cb = vi.fn((s: z.core.$ZodType) => s);
  const Node: any = z.object({
    value: z.number(),
    get children() {
      return z.array(Node);
    },
  });
  expect(visit(Node, cb)).toBe(Node);
  const calls = cb.mock.calls.length;
  const swapped = visit(Node, { number: () => z.string() }) as any;
  expect(swapped.parse({ value: "a", children: [{ value: "b", children: [] }] })).toBeTruthy();
  expect(() => swapped.parse({ value: "a", children: [{ value: 1, children: [] }] })).toThrow();
  const L: any = z.lazy(() => z.object({ v: z.number(), next: L.optional() }));
  L.parse({ v: 1 });
  const out = visit(L, { number: () => z.string() }) as any;
  expect(out.parse({ v: "a", next: { v: "b" } })).toEqual({ v: "a", next: { v: "b" } });
  expect(() => out.parse({ v: "a", next: { v: 2 } })).toThrow();
  expect(cb.mock.calls.length).toBe(calls);
});

test("deepPartial", () => {
  const S = z.object({
    a: z.string().min(1),
    arr: z.array(z.object({ b: z.number() })),
    tup: z.tuple([z.object({ c: z.string() })], z.object({ d: z.string() })),
    rec: z.record(z.string(), z.object({ e: z.string() })),
    m: z.map(z.string(), z.object({ f: z.string() })),
    u: z.discriminatedUnion("k", [z.object({ k: z.literal("a"), g: z.string() })]),
    c: z.object({ h: z.string() }).catchall(z.object({ i: z.string() })),
    cd: codec,
    pre: z.preprocess((v) => v, z.object({ j: z.string() })),
  });
  const P = z.deepPartial(S);
  expect(P.shape.a).toBeInstanceOf(z.ZodOptional);
  expect(P.parse({ arr: [{}], tup: [{}, {}], rec: { x: {} }, m: new Map([["a", {}]]), u: {}, c: { x: {} } })).toBeTruthy();
  expect(() => P.parse({ a: "" })).toThrow();
  expect(() => P.parse({ tup: [] })).toThrow();
  expect((P.shape.u as any).unwrap().def.type).toBe("union");
  expect(S.shape.a).not.toBe(P.shape.a);
  expect(S.parse).toBeTruthy();
  expect(() => S.parse({ arr: [{}] })).toThrow();
  expect(P.parse({ cd: "5" }).cd).toBe(5n);
  expect(P.parse({ pre: {} })).toBeTruthy();
});

test("deepPartial recursion", () => {
  interface N {
    v: string;
    children: N[];
  }
  const Node: z.ZodType<N> & any = z.object({
    v: z.string(),
    get children(): z.ZodArray<any> {
      return z.array(Node);
    },
  });
  const P = z.deepPartial(Node) as any;
  expect(P.parse({ children: [{ children: [{}] }] })).toBeTruthy();
  const Lz: any = z.object({ v: z.string(), n: z.lazy(() => Lz).optional() });
  Lz.parse({ v: "a" });
  expect((z.deepPartial(Lz) as any).parse({ n: { n: {} } })).toBeTruthy();
  expectTypeOf(P).not.toBeNever();
});

test("input / output", () => {
  const S = z.object({ b: codec });
  expect(z.output(S).parse({ b: 1n })).toEqual({ b: 1n });
  expect(z.input(S).parse({ b: "1" })).toEqual({ b: "1" });
  const plain = z.object({ a: z.array(z.string()) });
  expect(z.input(plain)).toBe(plain);
  expect(z.output(plain)).toBe(plain);
  expectTypeOf<z.output<typeof S>>().toEqualTypeOf<{ b: bigint }>();
});
