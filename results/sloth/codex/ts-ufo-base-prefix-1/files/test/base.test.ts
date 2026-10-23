import { describe, expect, test } from "vitest";
import { withBase, withoutBase } from "../src";

test("base prefixes must end at a path boundary", () => {
  for (const base of ["/admin", "/admin/"]) {
    for (const input of [
      "/admin-dashboard",
      "/administrator",
      "/admin%2Fdashboard",
    ]) {
      expect(withoutBase(input, base)).toBe(input);
      expect(withBase(input, base)).toBe("/admin" + input);
    }
    for (const [input, output] of [
      ["/admin", "/"],
      ["/admin/", "/"],
      ["/admin/dashboard", "/dashboard"],
      ["/admin?x", "/?x"],
      ["/admin#x", "/#x"],
    ]) {
      expect(withoutBase(input, base)).toBe(output);
      expect(withBase(input, base)).toBe(input);
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
