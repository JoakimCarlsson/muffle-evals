import { expect, expectTypeOf, test } from "vitest";
import * as z from "zod/v4";
import { visit } from "../../core/visit.js";

const stringToBigInt = z.codec(z.string(), z.bigint(), {
  decode: (s) => BigInt(s),
  encode: (b) => b.toString(),
});

test("visit: untouched schema is same object", () => {
  const s = z.object({ a: z.array(z.string()), b: z.union([z.number(), z.null()]) });
  expect(visit(s, (x) => x)).toBe(s);
  expect(visit(s, { number: (x) => x })).toBe(s);
});

test("visit: shared node visited once", () => {
  const inner = z.object({ s: z.string() });
  const seen: string[] = [];
  visit(z.object({ x: inner, y: inner }), (s) => {
    seen.push(s._zod.def.type);
    return s;
  });
  expect(seen).toHaveLength(3);
});

test("visit: handler map, identity of untouched siblings, unknown type", () => {
  const sib = z.object({ k: z.string() });
  const root = z.object({ n: z.number(), sib });
  const out = visit(root, { number: () => z.string() }) as typeof root;
  expect(out).not.toBe(root);
  expect(out.shape.sib).toBe(sib);
  expect(out.shape.n._zod.def.type).toBe("string");
  const custom = z.string().clone({ type: "weird" } as any) as any;
  expect(visit(custom, () => z.string())).toBe(custom);
});

test("visit: strict / loose kept", () => {
  const s = visit(z.strictObject({ a: z.number() }), { number: () => z.string() }) as z.ZodObject<any>;
  expect(s.safeParse({ a: "x", b: 1 }).success).toBe(false);
  const l = visit(z.looseObject({ a: z.number() }), { number: () => z.string() }) as z.ZodObject<any>;
  expect(l.parse({ a: "x", b: 1 })).toEqual({ a: "x", b: 1 });
});

test("deepPartial: containers", () => {
  const o = z.object({ a: z.string(), b: z.object({ c: z.number() }) });
  const s = z.deepPartial(
    z.object({
      arr: z.array(o),
      tup: z.tuple([o, z.string()], o),
      rec: z.record(z.string(), o),
      map: z.map(z.string(), o),
      set: z.set(o),
      un: z.union([o, z.string()]),
      inter: z.intersection(o, z.object({ q: z.number() })),
      opt: o.nullable().default({ a: "x", b: { c: 1 } }).readonly(),
      prom: z.promise(o),
      pipe: z.string().pipe(z.string()),
      pre: z.preprocess((v) => v, o),
      codec: z.codec(z.object({ a: z.string() }), z.string(), { decode: () => "", encode: () => ({ a: "" }) }),
    }).catchall(o)
  );
  const r = s.parse({
    arr: [{}, { b: {} }],
    tup: [{}, "s", {}],
    rec: { k: { b: {} } },
    map: new Map([["k", {}]]),
    set: new Set([{}]),
    un: {},
    inter: {},
    opt: { b: {} },
    pipe: "x",
    pre: {},
    codec: {},
    extra: { b: {} },
  });
  expect(r.arr).toHaveLength(2);
  expect(s.safeParse({ tup: [{}] }).success).toBe(false);
  expect(s.shape.arr).toBeInstanceOf(z.ZodOptional);
  expect(s.keyof().options).toContain("arr");
});

test("deepPartial: preprocess/codec kept, transforms and checks untouched", () => {
  const s = z.deepPartial(z.object({ s: z.string().min(1), t: z.string().transform((x) => x.length), c: stringToBigInt }));
  expect(s.safeParse({ s: "" }).success).toBe(false);
  expect(s.parse({ t: "abc", c: "5" })).toEqual({ t: 3, c: 5n });
  const pre = z.deepPartial(z.preprocess((v) => v, z.object({ a: z.string() }))) as any;
  expect(pre._zod.def.in._zod.def.type).toBe("transform");
  const c = z.deepPartial(stringToBigInt);
  expect(c).toBeInstanceOf(z.ZodCodec);
});

test("deepPartial: discriminated union becomes union, input untouched", () => {
  const du = z.discriminatedUnion("t", [z.object({ t: z.literal("a"), x: z.string() }), z.object({ t: z.literal("b") })]);
  const p = z.deepPartial(du);
  expect(p._zod.def.type).toBe("union");
  expect((p._zod.def as any).discriminator).toBeUndefined();
  expect(p.parse({})).toEqual({});
  expect(du.safeParse({ t: "a" }).success).toBe(false);
  const o = z.object({ a: z.object({ b: z.string() }) });
  z.deepPartial(o);
  expect(o.safeParse({ a: {} }).success).toBe(false);
});

test("deepPartial: recursion", () => {
  type Node = { name: string; children: Node[] };
  const Node: z.ZodType<any> = z.object({
    name: z.string(),
    get children() {
      return z.array(Node);
    },
  });
  const p = z.deepPartial(Node);
  expect(p.parse({ children: [{ children: [{}] }] })).toEqual({ children: [{ children: [{}] }] });
  expect(Node.safeParse({ children: [] }).success).toBe(false);

  const Lz: z.ZodType<any> = z.object({ name: z.string(), kids: z.array(z.lazy(() => Lz)) });
  Lz.parse({ name: "a", kids: [{ name: "b", kids: [] }] });
  const lp = z.deepPartial(Lz);
  expect(lp.parse({ kids: [{ kids: [{}] }] })).toEqual({ kids: [{ kids: [{}] }] });
});

test("visit: recursion not re-run at parse, resolved lazy rewritten", () => {
  const Node: z.ZodType<any> = z.object({
    n: z.number(),
    get children() {
      return z.array(Node);
    },
  });
  let calls = 0;
  const out = visit(Node, (s) => {
    calls++;
    return s._zod.def.type === "number" ? z.string() : s;
  }) as z.ZodType;
  const after = calls;
  expect(out.safeParse({ n: "a", children: [{ n: "b", children: [] }] }).success).toBe(true);
  expect(calls).toBe(after);
  const Lz: z.ZodType<any> = z.object({ n: z.number(), k: z.array(z.lazy(() => Lz)) });
  Lz.parse({ n: 1, k: [{ n: 2, k: [] }] });
  const o2 = visit(Lz, { number: () => z.string() }) as z.ZodType;
  expect(o2.safeParse({ n: "a", k: [{ n: "b", k: [] }] }).success).toBe(true);
  expect(visit(Lz, (s) => s)).toBe(Lz);
  expect(visit(Node, (s) => s)).toBe(Node);
});

test("z.input / z.output", () => {
  const s = z.object({ b: stringToBigInt, l: z.array(stringToBigInt) });
  expect(z.output(s).parse({ b: 1n, l: [2n] })).toEqual({ b: 1n, l: [2n] });
  expect(z.input(s).parse({ b: "1", l: ["2"] })).toEqual({ b: "1", l: ["2"] });
  const plain = z.object({ a: z.string() });
  expect(z.input(plain)).toBe(plain);
  expect(z.output(plain)).toBe(plain);
  expect(z.output(z.record(z.string(), stringToBigInt)).parse({ a: 1n })).toEqual({ a: 1n });
  expect(z.input(z.preprocess((v) => v, z.string())).parse(5)).toBe(5);
  expectTypeOf(z.output(s).parse).returns.toEqualTypeOf<{ b: bigint; l: bigint[] }>();
});

test("deepPartial: recursive getter types stay shallow", () => {
  const Cat = z.object({
    name: z.string(),
    get subs() {
      return z.array(Cat);
    },
  });
  const p = z.deepPartial(Cat);
  expectTypeOf(p.shape.name).toEqualTypeOf<z.ZodOptional<z.ZodString>>();
  expect(p.parse({ subs: [{}] })).toEqual({ subs: [{}] });
});
