import { expect, test } from "vitest";
import * as z from "zod/mini";

test("mini deepPartial / input / output", () => {
  const p = z.deepPartial(
    z.object({ a: z.array(z.object({ x: z.number() })) }),
  );
  expect(z.parse(p, { a: [{}] })).toEqual({ a: [{}] });
  const c = z.codec(z.number(), z.bigint(), {
    decode: (n) => BigInt(n),
    encode: (b) => Number(b),
  });
  const s = z.object({ b: c });
  expect(z.parse(z.output(s), { b: 1n })).toEqual({ b: 1n });
  expect(z.parse(z.input(s), { b: 1 })).toEqual({ b: 1 });
});
