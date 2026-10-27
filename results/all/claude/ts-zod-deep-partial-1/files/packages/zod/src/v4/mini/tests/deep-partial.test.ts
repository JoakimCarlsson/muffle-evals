import { expect, test } from "vitest";
import * as z from "zod/mini";

const stringToBigInt = z.codec(z.string(), z.bigint(), {
  decode: (s) => BigInt(s),
  encode: (b) => b.toString(),
});

test("deepPartial", () => {
  const s = z.deepPartial(
    z.object({ a: z.array(z.object({ b: z.string() })), d: z.discriminatedUnion("t", [z.object({ t: z.literal("x") })]) })
  );
  expect(s.parse({ a: [{}], d: {} })).toEqual({ a: [{}], d: {} });
  expect(s.shape.a).toBeInstanceOf(z.ZodMiniOptional);
  const Node: z.ZodMiniType<any> = z.object({
    name: z.string(),
    get children() {
      return z.array(Node);
    },
  });
  expect(z.deepPartial(Node).parse({ children: [{}] })).toEqual({ children: [{}] });
});

test("input / output", () => {
  const s = z.object({ b: stringToBigInt });
  expect(z.output(s).parse({ b: 1n })).toEqual({ b: 1n });
  expect(z.input(s).parse({ b: "1" })).toEqual({ b: "1" });
  const plain = z.object({ a: z.string() });
  expect(z.output(plain)).toBe(plain);
});
