import { describe, expect, it } from "vitest";

import {
  normalizeAliases,
  filename,
  resolveAlias,
  reverseResolveAlias,
} from "../src/utils";

describe("alias", () => {
  const _aliases = {
    "@foo/bar": "@foo/bar/dist/index.mjs",
    "@foo/bar/utils": "@foo/bar/dist/utils.mjs",
    "@": "/root",
    bingpot: "@/bingpot/index.ts",
    test: "@bingpot/index.ts",
    "~": "/root/index.js",
    "~/": "/src",
    "~win": "C:/root/index.js",
    "~win/": "C:/src",
  };
  const aliases = normalizeAliases(_aliases);

  it("normalizeAliases", () => {
    expect(aliases).toMatchInlineSnapshot(`
      {
        "@": "/root",
        "@foo/bar": "@foo/bar/dist/index.mjs",
        "@foo/bar/utils": "@foo/bar/dist/utils.mjs",
        "bingpot": "/root/bingpot/index.ts",
        "test": "@bingpot/index.ts",
        "~": "/root/index.js",
        "~/": "/src",
        "~win": "C:/root/index.js",
        "~win/": "C:/src",
      }
    `);
  });

  describe("reverseResolveAlias", () => {
    it("returns all matches sorted longest first", () => {
      expect(
        reverseResolveAlias("/root/some/assets/smth.jpg", {
          "~": "/root",
          "~assets": "/root/some/assets",
        }),
      ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
      expect(reverseResolveAlias("/root/index.js", aliases)).toEqual([
        "@/index.js",
        "~",
      ]);
    });
    it("normalizes aliases before matching", () => {
      expect(reverseResolveAlias("/root/bingpot/index.ts", _aliases)).toEqual([
        "@/bingpot/index.ts",
        "bingpot",
      ]);
    });
    it("respects path boundaries and unmatched paths", () => {
      for (const path of ["/rooted/foo", "./bar.js", "/other"]) {
        expect(reverseResolveAlias(path, { "@": "/root" })).toEqual([]);
      }
    });
    it("preserves aliases ending with a slash", () => {
      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
        "~/foo/bar",
      ]);
      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
    });
    it("handles targets ending with a slash", () => {
      expect(reverseResolveAlias("/src/foo", { "@": "/src/" })).toEqual([
        "@/foo",
      ]);
      expect(reverseResolveAlias("/src", { "@": "/src/" })).toEqual(["@"]);
      expect(reverseResolveAlias("/foo", { "@": "/" })).toEqual(["@/foo"]);
    });
    it("normalizes Windows paths and targets", () => {
      expect(
        reverseResolveAlias(String.raw`C:\src\foo\bar`, {
          "~/": String.raw`C:\src`,
        }),
      ).toEqual(["~/foo/bar"]);
    });
  });

  describe("resolveAlias", () => {
    for (const [from, to] of Object.entries(aliases)) {
      it(from, () => {
        expect(resolveAlias(from, aliases)).toBe(to);
      });
    }
    it("respects path separators", () => {
      const aliases = {
        "~": "/root",
        "~assets": "/root/some/dir",
      };
      expect(resolveAlias("~assets/smth.jpg", aliases)).toMatchInlineSnapshot(
        '"/root/some/dir/smth.jpg"',
      );
    });
    it("unchanged", () => {
      expect(resolveAlias("foo/bar.js", aliases)).toBe("foo/bar.js");
      expect(resolveAlias("./bar.js", aliases)).toBe("./bar.js");
    });
    it("respect ending with /", () => {
      expect(resolveAlias("~/foo/bar", aliases)).toBe("/src/foo/bar");
      expect(resolveAlias("~win/foo/bar", aliases)).toBe("C:/src/foo/bar");
    });
  });
});

describe("filename", () => {
  const files = {
    // POSIX
    "test.html": "test",
    "/temp/myfile.html": "myfile",
    "./myfile.html": "myfile",
    "/Users/john.doe/foo/myFile.js": "myFile",
    "/Users/john.doe/foo/myFile": "myFile",
    "./.hidden/myFile.ts": "myFile",
    "./.hidden/myFile": "myFile",
    "/temp/.gitignore": ".gitignore",
    "./foo.bar.baz.js": "foo.bar.baz",

    // Windows
    "C:\\temp\\": undefined,
    "C:\\temp\\myfile.html": "myfile",
    "\\temp\\myfile.html": "myfile",
    ".\\myfile.html": "myfile",
    ".\\john.doe\\myfile.js": "myfile",
    ".\\john.doe\\myfile": "myfile",
    ".\\.hidden\\myfile.js": "myfile",
    ".\\.hidden\\myfile": "myfile",
    "C:\\temp\\.gitignore": ".gitignore",
    "C:\\temp\\foo.bar.baz.js": "foo.bar.baz",
  };
  for (const file in files) {
    it(file, () => {
      expect(filename(file)).toEqual(files[file]);
    });
  }
});
