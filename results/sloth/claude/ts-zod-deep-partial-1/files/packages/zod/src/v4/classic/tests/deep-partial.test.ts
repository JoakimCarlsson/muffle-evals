import { expect, expectTypeOf, test } from "vitest";
import * as z from "zod/v4";

const stringToBigInt = z.codec(z.string(), z.bigint(), {
  decode: (s) => BigInt(s),
  encode: (b) => b.toString(),
});

test("deepPartial: objects through containers", () => {
  const s = z.object({
    a: z.string(),
    arr: z.array(z.object({ x: z.number() })),
    tup: z.tuple([z.object({ x: z.number() }), z.number()], z.object({ y: z.number() })),
    rec: z.record(z.string(), z.object({ x: z.number() })),
    map: z.map(z.string(), z.object({ x: z.number() })),
    set: z.set(z.object({ x: z.number() })),
    u: z.union([z.object({ x: z.number() }), z.string()]),
    i: z.intersection(z.object({ x: z.number() }), z.object({ y: z.number() })),
    n: z.object({ x: z.number() }).nullable().default(null).readonly(),
    c: z.object({ a: z.string() }).catchall(z.object({ x: z.number() })),
  });
  const p = z.deepPartial(s);
  expect(p.safeParse({}).success).toBe(true);
  expect(p.safeParse({ arr: [{}], rec: { k: {} }, map: new Map([["k", {}]]), set: new Set([{}]) }).success).toBe(true);
  expect(p.safeParse({ tup: [{}, 1, {}] }).success).toBe(true);
  expect(p.safeParse({ tup: [{}] }).success).toBe(false);
  expect(p.safeParse({ u: {}, i: {}, c: { k: {} }, n: {} }).success).toBe(true);
  expect(s.safeParse({}).success).toBe(false);
  expectTypeOf(p.shape.a).toEqualTypeOf<z.ZodOptional<z.ZodString>>();
  expect(Object.keys(p.extend({ z: z.string() }).shape)).toContain("z");
  expect(p.keyof().options).toContain("arr");
});

test("deepPartial: promise", async () => {
  const p = z.deepPartial(z.promise(z.object({ x: z.number() })));
  await expect(p.parseAsync(Promise.resolve({}))).resolves.toEqual({});
});

test("deepPartial: leaves with checks untouched, strict kept", () => {
  const p = z.deepPartial(z.strictObject({ s: z.string().min(1), t: z.string().transform((x) => x.length) }));
  expect(p.safeParse({ s: "" }).success).toBe(false);
  expect(p.safeParse({ t: "abc" }).data).toEqual({ t: 3 });
  expect(p.safeParse({ q: 1 }).success).toBe(false);
});

test("deepPartial: discriminated union becomes plain union", () => {
  const u = z.discriminatedUnion("t", [
    z.object({ t: z.literal("a"), x: z.number() }),
    z.object({ t: z.literal("b"), y: z.number() }),
  ]);
  const p = z.deepPartial(u);
  expect(p._zod.def.type).toBe("union");
  expect((p._zod.def as any).discriminator).toBeUndefined();
  expect(p.safeParse({}).success).toBe(true);
  expect(u.safeParse({}).success).toBe(false);
});

test("deepPartial: codecs and preprocess kept", () => {
  const s = z.object({
    c: z.codec(z.object({ a: z.string() }), z.object({ b: z.string() }), {
      decode: () => ({ b: "x" }),
      encode: () => ({ a: "x" }),
    }),
    pre: z.preprocess((v) => v, z.object({ a: z.string() })),
  });
  const p = z.deepPartial(s);
  expect(p.safeParse({ c: {}, pre: {} }).success).toBe(true);
  expect(z.encode(p.shape.c.unwrap() as any, {} as any)).toEqual({ a: "x" });
  expect((p.shape.pre.unwrap() as any)._zod.def.in._zod.def.type).toBe("transform");
});

test("deepPartial: recursive schemas and no mutation", () => {
  const Node = z.object({
    name: z.string(),
    get children() {
      return z.array(Node);
    },
  });
  const lazyNode: z.ZodType<any> = z.object({ name: z.string(), kids: z.array(z.lazy(() => lazyNode)) });
  const p = z.deepPartial(Node);
  expect(p.safeParse({ children: [{ children: [{}] }] }).success).toBe(true);
  expect(Node.safeParse({ children: [] }).success).toBe(false);
  const lp = z.deepPartial(lazyNode);
  expect(lp.safeParse({ kids: [{ kids: [{}] }] }).success).toBe(true);
  expect(lazyNode.safeParse({ kids: [] }).success).toBe(false);
});

test("z.input / z.output", () => {
  const s = z.object({ b: stringToBigInt, a: z.array(stringToBigInt) });
  expect(z.output(s).parse({ b: 1n, a: [2n] })).toEqual({ b: 1n, a: [2n] });
  expect(z.input(s).parse({ b: "1", a: ["2"] })).toEqual({ b: "1", a: ["2"] });
  expect(z.output(z.record(z.string(), stringToBigInt)).parse({ k: 1n })).toEqual({ k: 1n });
  const plain = z.object({ a: z.string() });
  expect(z.input(plain)).toBe(plain);
  expect(z.output(plain)).toBe(plain);
  expectTypeOf<z.input<typeof s>>().toEqualTypeOf<{ b: string; a: string[] }>();
});
