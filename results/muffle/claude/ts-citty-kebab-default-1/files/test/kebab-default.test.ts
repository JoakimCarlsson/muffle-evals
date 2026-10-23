import { expect, it } from "vitest";
import { parseArgs } from "../src/args.ts";

it("kebab-case input overrides camelCase default", () => {
  const def = { fooBar: { type: "enum", options: ["one", "two"], default: "two" } } as const;
  const r: any = parseArgs(["--foo-bar", "one"], def as any);
  expect(r.fooBar).toBe("one");
  expect(r["foo-bar"]).toBe("one");
  expect((parseArgs([], def as any) as any).fooBar).toBe("two");
});
