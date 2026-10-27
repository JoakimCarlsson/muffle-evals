import { expect, test } from "vitest";
import * as z from "zod/mini";

test("deepPartial", () => {
  const s = z.object({ a: z.array(z.object({ x: z.string() })), n: z.nullable(z.object({ y: z.string() })) });
  const d = z.deepPartial(s);
  expect(d.safeParse({ a: [{}], n: {} }).success).toBe(true);
  expect(d.shape.a).toBeInstanceOf(z.ZodMiniOptional);
  expect(s.safeParse({}).success).toBe(false);
});

test("input / output", () => {
  const b = z.codec(z.string(), z.bigint(), { decode: (s) => BigInt(s), encode: (n) => n.toString() });
  expect(z.output(z.object({ b })).parse({ b: 1n })).toEqual({ b: 1n });
  expect(z.input(z.object({ b })).parse({ b: "1" })).toEqual({ b: "1" });
});
