import { expect, it } from "vitest";
import { parseArgs } from "../src/args.ts";

it("kebab-case input overrides camelCase default", () => {
  const def = { fooBar: { type: "enum", options: ["one", "two"], default: "two" } } as const;
  const a = parseArgs(["--foo-bar", "one"], def) as any;
  expect(a.fooBar).toBe("one");
  expect(a["foo-bar"]).toBe("one");
  expect((parseArgs([], def) as any).fooBar).toBe("two");
});
