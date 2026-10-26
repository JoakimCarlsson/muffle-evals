import { it, expect } from "vitest";
import { parseArgs } from "../src/args.ts";

it("kebab-case input overrides camelCase default", () => {
  const args = {
    fooBar: { type: "enum", options: ["one", "two"], default: "two" },
  } as const;
  const r = parseArgs<typeof args>(["--foo-bar", "one"], args as any);
  expect(r.fooBar).toBe("one");
  expect((r as any)["foo-bar"]).toBe("one");
  expect(parseArgs<typeof args>([], args as any).fooBar).toBe("two");
});
