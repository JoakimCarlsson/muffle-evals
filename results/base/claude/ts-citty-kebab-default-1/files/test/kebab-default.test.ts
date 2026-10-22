import { expect, it } from "vitest";
import { parseArgs } from "../src/args.ts";

it("kebab-case input overrides camelCase default", () => {
  const args = {
    fooBar: { type: "enum", options: ["one", "two"], default: "two" },
  } as const;
  const r: any = parseArgs(["--foo-bar", "one"], args as any);
  expect(r.fooBar).toBe("one");
  expect(r["foo-bar"]).toBe("one");
  expect((parseArgs([], args as any) as any).fooBar).toBe("two");
});
