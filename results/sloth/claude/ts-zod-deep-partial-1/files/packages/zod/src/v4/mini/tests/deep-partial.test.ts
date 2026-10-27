import { expect, test } from "vitest";
import * as z from "zod/mini";

test("deepPartial", () => {
  const s = z.object({ a: z.array(z.object({ x: z.number() })), u: z.discriminatedUnion("t", [z.object({ t: z.literal("a") })]) });
  const p = z.deepPartial(s);
  expect(p.safeParse({ a: [{}], u: {} }).success).toBe(true);
  expect(s.safeParse({}).success).toBe(false);
  expect(p.shape.a._zod.def.type).toBe("optional");
});

test("input / output", () => {
  const codec = z.codec(z.string(), z.bigint(), { decode: (s) => BigInt(s), encode: (b) => b.toString() });
  expect(z.output(z.object({ b: codec })).parse({ b: 1n })).toEqual({ b: 1n });
  expect(z.input(z.object({ b: codec })).parse({ b: "1" })).toEqual({ b: "1" });
  const plain = z.object({ a: z.string() });
  expect(z.output(plain)).toBe(plain);
});
