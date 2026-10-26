import { expect, it } from "vitest";
import { parseArgs } from "../src/args.ts";

it("kebab-case input overrides camelCase default", () => {
  const r = parseArgs(["--foo-bar", "one"], {
    fooBar: { type: "enum", options: ["one", "two"], default: "two" },
  }) as any;
  expect(r.fooBar).toBe("one");
  expect(r["foo-bar"]).toBe("one");
  const d = parseArgs([], {
    fooBar: { type: "enum", options: ["one", "two"], default: "two" },
  }) as any;
  expect(d.fooBar).toBe("two");
  expect(d["foo-bar"]).toBe("two");
});
