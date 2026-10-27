import { expect, expectTypeOf, test } from "vitest";
import * as z from "zod/v4";

test("objects through containers", () => {
  const s = z.object({
    a: z.array(z.object({ x: z.string() })),
    t: z.tuple([z.object({ x: z.string() })], z.object({ y: z.number() })),
    r: z.record(z.string(), z.object({ x: z.string() })),
    m: z.map(z.string(), z.object({ x: z.string() })),
    st: z.set(z.object({ x: z.string() })),
    u: z.union([z.object({ k: z.string() }), z.number()]),
    i: z.intersection(z.object({ p: z.string() }), z.object({ q: z.string() })),
    w: z.object({ x: z.string() }).nullable().default({} as any).readonly(),
    p: z.promise(z.object({ x: z.string() })),
    c: z.object({ x: z.string() }).catchall(z.object({ y: z.string() })),
  });
  const d = z.deepPartial(s);
  expect(d.safeParse({}).success).toBe(true);
  expect(d.safeParse({ a: [{}], t: [{}, {}], r: { k: {} }, m: new Map([["k", {}]]), st: new Set([{}]), u: {}, i: {}, c: { z: {} } }).success).toBe(true);
  expect(d.safeParse({ t: [] }).success).toBe(false); // positions stay required
  expect(s.shape.a.safeParse([{}]).success).toBe(false); // input untouched
  expect(d.shape.a).toBeInstanceOf(z.ZodOptional);
  expectTypeOf(d.shape.a).toEqualTypeOf<z.ZodOptional<typeof s.shape.a>>();
  expect(Object.keys(d.extend({ z: z.string() }).shape)).toContain("z");
  expect(d.keyof().options).toContain("a");
});

test("checks, transforms stay", () => {
  const d = z.deepPartial(z.object({ s: z.string().min(1), t: z.string().transform((x) => x.length) }));
  expect(d.safeParse({ s: "" }).success).toBe(false);
  expect(d.parse({ t: "abc" })).toEqual({ t: 3 });
});

test("discriminated union becomes union", () => {
  const s = z.discriminatedUnion("t", [z.object({ t: z.literal("a"), x: z.string() }), z.object({ t: z.literal("b"), y: z.number() })]);
  const d = z.deepPartial(s);
  expect(d._zod.def.type).toBe("union");
  expect((d as any)._zod.def.discriminator).toBeUndefined();
  expect(d.parse({})).toEqual({});
  expect(d.safeParse({ t: "b", y: "no" }).success).toBe(false);
});

test("codec and preprocess are kept", () => {
  const codec = z.codec(z.object({ a: z.string() }), z.object({ b: z.number() }), {
    decode: (v) => ({ b: Number(v.a ?? 0) }),
    encode: (v) => ({ a: String(v.b) }),
  });
  const pre = z.preprocess((v) => v, z.object({ a: z.string() }));
  const d = z.deepPartial(z.object({ codec, pre }));
  expect(d.shape.codec.unwrap()).toBeInstanceOf(z.ZodCodec);
  expect(d.shape.pre.unwrap()).toBeInstanceOf(z.ZodPipe);
  expect(d.shape.pre.unwrap()._zod.def.in._zod.def.type).toBe("transform");
  expect(d.parse({ codec: {}, pre: {} })).toBeTruthy();
});

test("recursive schemas", () => {
  const Node = z.object({
    name: z.string(),
    get children() {
      return z.array(Node);
    },
  });
  const d = z.deepPartial(Node);
  expect(d.safeParse({ children: [{ children: [{}] }] }).success).toBe(true);
  expect(Node.safeParse({ children: [] }).success).toBe(false);

  type Cat = { name: string; kids: Cat[] };
  const Cat: z.ZodType<Cat> = z.object({ name: z.string(), kids: z.array(z.lazy(() => Cat)) });
  Cat.parse({ name: "a", kids: [] });
  const dc = z.deepPartial(Cat);
  expect(dc.safeParse({ kids: [{ kids: [{}] }] }).success).toBe(true);
});

test("non-objects are returned as is", () => {
  const s = z.string().min(1);
  expect(z.deepPartial(s)).toBe(s);
});

test("input / output", () => {
  const b = z.codec(z.string(), z.bigint(), { decode: (s) => BigInt(s), encode: (n) => n.toString() });
  const s = z.object({ b, list: z.array(b), t: z.string().transform((x) => x.length) });
  expect(z.output(s).parse({ b: 1n, list: [2n], t: 5 })).toEqual({ b: 1n, list: [2n], t: 5 });
  expect(z.input(s).parse({ b: "1", list: ["2"], t: "x" })).toEqual({ b: "1", list: ["2"], t: "x" });
  const plain = z.object({ a: z.string() });
  expect(z.input(plain)).toBe(plain);
  expect(z.output(plain)).toBe(plain);
});
