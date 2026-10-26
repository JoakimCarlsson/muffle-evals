import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/args.ts";
import type { ArgsDef } from "../src/types.ts";

describe("args", () => {
  it.each([
    [[], {}, { _: [] }],
    /**
     * String
     */
    [["--name", "John"], { name: { type: "string" } }, { name: "John", _: [] }],
    [[], { name: { type: "string", default: "John" } }, { name: "John", _: [] }],
    [["--name", "Jane"], { name: { type: "string", default: "John" } }, { name: "Jane", _: [] }],
    [["-n", "Jane"], { name: { type: "string", alias: "n" } }, { name: "Jane", n: "Jane", _: [] }],
    /**
     * Boolean
     */
    [["--force"], { force: { type: "boolean" } }, { force: true, _: [] }],
    [["-f"], { force: { alias: "f", type: "boolean" } }, { force: true, f: true, _: [] }],
    [[], { force: { type: "boolean", default: true } }, { force: true, _: [] }],
    [
      ["--no-force"],
      { force: { type: "boolean", negativeDescription: "force" } },
      { force: false, _: [] },
    ],
    /**
     * Positional
     */
    [
      ["subCommand"],
      { command: { type: "positional" } },
      { _: ["subCommand"], command: "subCommand" },
    ],
    [
      [],
      { command: { type: "positional", default: "subCommand" } },
      { _: [], command: "subCommand" },
    ],
    [[], { command: { type: "positional", required: false } }, { _: [] }],
    /**
     * Enum
     */
    [
      ["--value", "one"],
      { value: { type: "enum", options: ["one", "two"] } },
      { value: "one", _: [] },
    ],
  ] as [string[], ArgsDef, any][])(
    "should parsed correctly %o (%o)",
    (rawArgs, definition, result) => {
      const parsed = parseArgs(rawArgs, definition);

      expect(parsed).toEqual(result);
    },
  );

  it.each<[string[], ArgsDef, string]>([
    [[], { name: { type: "string", required: true } }, "Missing required argument: --name"],
    [
      [],
      {
        name: { type: "positional" },
      },
      "Missing required positional argument: NAME",
    ],
    [
      ["--value", "three"],
      { value: { type: "enum", options: ["one", "two"] } },
      "Invalid value for argument: --value (three). Expected one of: one, two.",
    ],
  ])("should throw error with %o (%o)", (rawArgs, definition, result) => {
    // TODO: should check for exact match
    // https://github.com/vitest-dev/vitest/discussions/6048
    expect(() => {
      parseArgs(rawArgs, definition);
    }).toThrowError(result);
  });

  it.each(["fooBar", "foo-bar"])(
    "should override defaults through either spelling of %s",
    (name) => {
      const definition: ArgsDef = {
        [name]: { type: "enum", options: ["one", "two"], default: "two", alias: "f" },
      };

      for (const flag of ["--foo-bar", "--fooBar", "-f"]) {
        expect(parseArgs([flag, "one"], definition)).toEqual({
          _: [],
          fooBar: "one",
          "foo-bar": "one",
          f: "one",
        });
      }

      expect(parseArgs([], definition)).toEqual({
        _: [],
        fooBar: "two",
        "foo-bar": "two",
        f: "two",
      });
      expect(() => parseArgs(["--foo-bar", "three"], definition)).toThrow(
        "Invalid value for argument",
      );
    },
  );

  it("should resolve camelCase argument", () => {
    const definition: ArgsDef = {
      "user-name": { type: "string" },
    };
    const rawArgs = ["--userName", "Jane"];

    const parsed = parseArgs(rawArgs, definition);

    expect(parsed["user-name"]).toBe("Jane");
    expect(parsed._).toEqual([]);
  });

  it("should resolve kebab-case argument", () => {
    const definition: ArgsDef = {
      userName: { type: "string" },
    };
    const rawArgs = ["--user-name", "Jane"];

    const parsed = parseArgs(rawArgs, definition);

    expect(parsed.userName).toBe("Jane");
    expect(parsed._).toEqual([]);
  });
});
