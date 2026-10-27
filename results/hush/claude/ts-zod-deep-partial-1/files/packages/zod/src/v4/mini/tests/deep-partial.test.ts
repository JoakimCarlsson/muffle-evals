import { expect, expectTypeOf, test } from "vitest";
import * as z from "zod/mini";

test("deepPartial", () => {
  const S = z.object({ a: z.string(), arr: z.array(z.object({ b: z.number() })) });
  const P = z.deepPartial(S);
  expect(P.parse({ arr: [{}] })).toEqual({ arr: [{}] });
  expect(P.shape.a).toBeInstanceOf(z.ZodMiniOptional);
  expectTypeOf<keyof typeof P.shape>().toEqualTypeOf<"a" | "arr">();
  expect(() => S.parse({})).toThrow();

  const Node: any = z.object({
    v: z.string(),
    get children(): z.ZodMiniArray<any> {
      return z.array(Node);
    },
  });
  expect(z.deepPartial(Node).parse({ children: [{ children: [{}] }] })).toBeTruthy();
});

test("input / output", () => {
  const c = z.codec(z.string(), z.bigint(), { decode: (s) => BigInt(s), encode: (b) => b.toString() });
  const S = z.object({ b: c });
  expect(z.output(S).parse({ b: 1n })).toEqual({ b: 1n });
  expect(z.input(S).parse({ b: "1" })).toEqual({ b: "1" });
  expect(z.output(z.object({ a: z.string() }))).toBeDefined();
});
