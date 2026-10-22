import { expect, it } from "vitest";
import { parseArgs } from "../src/args.ts";

it("kebab input overrides camelCase default", () => {
  const r = parseArgs(["--foo-bar", "one"], {
    fooBar: { type: "enum", options: ["one", "two"], default: "two" },
  });
  expect(r.fooBar).toBe("one");
  expect(r["foo-bar"]).toBe("one");
});
