import { describe, expect, test } from "vitest";
import { withBase, withoutBase } from "../src";

describe("base path boundaries", () => {
  for (const base of ["/admin", "/admin/"]) {
    for (const suffix of ["-dashboard", "istrator", "%2Fdashboard"]) {
      const input = `/admin${suffix}`;
      test(`${base} does not contain ${input}`, () => {
        expect(withoutBase(input, base)).toBe(input);
        expect(withBase(input, base)).toBe(`/admin${input}`);
      });
    }

    for (const suffix of ["", "/dashboard", "?x", "#section"]) {
      const input = `/admin${suffix}`;
      test(`${base} contains ${input}`, () => {
        expect(withoutBase(input, base)).toBe(
          suffix.startsWith("/") ? suffix : `/${suffix}`,
        );
        expect(withBase(input, base)).toBe(input);
      });
    }
  }
});

describe("withBase", () => {
  const tests = [
    { base: "/", input: "/", out: "/" },
    { base: "/foo", input: "", out: "/foo" },
    { base: "/foo/", input: "/", out: "/foo" },
    { base: "/foo", input: "/bar", out: "/foo/bar" },
    { base: "/base/", input: "/base", out: "/base" },
    { base: "/base", input: "/base/", out: "/base/" },
    { base: "/base", input: "/base/a", out: "/base/a" },
    { base: "/base/", input: "/base/a", out: "/base/a" },
    { base: "/base/", input: "https://test.com", out: "https://test.com" },
    { base: "/", input: "https://test.com", out: "https://test.com" },
  ];

  for (const t of tests) {
    test(JSON.stringify(t.base) + " + " + JSON.stringify(t.input), () => {
      expect(withBase(t.input, t.base)).toBe(t.out);
    });
  }
});

describe("withoutBase", () => {
  const tests = [
    { base: "/", input: "/", out: "/" },
    { base: "/foo", input: "/", out: "/" },
    { base: "/foo/", input: "/", out: "/" },
    { base: "/foo", input: "/bar", out: "/bar" },
    { base: "/base/", input: "/base", out: "/" },
    { base: "/base", input: "/base/", out: "/" },
    { base: "/base", input: "/base/a", out: "/a" },
    { base: "/base/", input: "/base/a", out: "/a" },
    { base: "/base/a/", input: "/base/a", out: "/" },
    { base: "/", input: "/test/", out: "/test/" },
    { base: "/", input: "/?test", out: "/?test" },
    { base: "/api", input: "/api?test", out: "/?test" },
    { base: "/base/", input: "https://test.com", out: "https://test.com" },
    { base: "/", input: "https://test.com", out: "https://test.com" },
  ];

  for (const t of tests) {
    test(JSON.stringify(t.input) + "-" + JSON.stringify(t.base), () => {
      expect(withoutBase(t.input, t.base)).toBe(t.out);
    });
  }
});
