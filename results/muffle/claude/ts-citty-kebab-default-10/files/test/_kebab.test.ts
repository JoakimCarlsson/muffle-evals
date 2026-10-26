import { expect, it } from "vitest";
import { parseArgs } from "../src/args.ts";

it("kebab-case input overrides camelCase default", () => {
  const defs = { fooBar: { type: "enum", options: ["one", "two"], default: "two" } } as const;
  const r: any = parseArgs(["--foo-bar", "one"], defs as any);
  expect(r.fooBar).toBe("one");
  expect(r["foo-bar"]).toBe("one");
  expect((parseArgs([], defs as any) as any).fooBar).toBe("two");
});
