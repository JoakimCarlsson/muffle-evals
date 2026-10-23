// Based on https://github.com/jshttp/cookie (MIT)
// Copyright (c) 2012-2014 Roman Shtylman <shtylman@gmail.com>
// Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
// Last sync: e264dfa

import { describe, it, expect, expectTypeOf } from "vitest";
import { parse } from "../src";

describe("cookie.parse(str)", () => {
  it("should return empty object for empty string", () => {
    expect(parse("")).toMatchObject({});
  });

  it("should parse cookie string to object", () => {
    expect(parse("foo=bar")).toMatchObject({ foo: "bar" });
    expect(parse("foo=123")).toMatchObject({ foo: "123" });
  });

  it("should ignore OWS", () => {
    expect(parse("FOO    = bar;   baz  =   raz")).toMatchObject({
      FOO: "bar",
      baz: "raz",
    });
  });

  it("should parse cookie with empty value", () => {
    expect(parse("foo= ; bar=")).toMatchObject({ foo: "", bar: "" });
  });

  it("should URL-decode values", () => {
    expect(parse("email=%20%22%2c%3b%2f")).toMatchObject({ email: ' ",;/' });
    expect(parse("foo=%1;bar=bar")).toMatchObject({ foo: "%1", bar: "bar" });
  });

  it("should return original value on escape error", () => {
    expect(parse("foo=%1;bar=bar")).toMatchObject({ foo: "%1", bar: "bar" });
  });

  it("should ignore cookies without value", () => {
    expect(parse("foo=bar;fizz  ;  buzz")).toMatchObject({ foo: "bar" });
    expect(parse("  fizz; foo=  bar")).toMatchObject({ foo: "bar" });
  });

  it("should ignore duplicate cookies", () => {
    expect(parse("foo=%1;bar=bar;foo=boo")).toMatchObject({
      foo: "%1",
      bar: "bar",
    });
    expect(parse("foo=false;bar=bar;foo=true")).toMatchObject({
      foo: "false",
      bar: "bar",
    });
    expect(parse("foo=;bar=bar;foo=boo")).toMatchObject({
      foo: "",
      bar: "bar",
    });
  });
});

describe("cookie.parse(str, options)", () => {
  describe('with "decode" option', () => {
    it("should specify alternative value decoder", () => {
      expect(
        parse("foo=YmFy", {
          decode: (v) => {
            return atob(v);
          },
        }),
      ).toMatchObject({ foo: "bar" });
    });

    it("parse filter key", () => {
      expect(
        parse("a=1;b=2", {
          filter: (key) => key === "a",
        }),
      ).toEqual({ a: "1" });

      expect(parse("a=1;b=2")).toEqual({ a: "1", b: "2" });
    });
  });
});

describe('with "allowMultiple" option', () => {
  it.each([
    ["foo=a;bar=bar;foo=b;foo=c", { foo: ["a", "b", "c"], bar: "bar" }],
    ["foo=;bar=bar;foo=boo", { foo: ["", "boo"], bar: "bar" }],
    ["foo=%1;foo=boo", { foo: ["%1", "boo"] }],
    ["foo=%20;foo=%2F", { foo: [" ", "/"] }],
    ["foo=a;foo=a", { foo: ["a", "a"] }],
    ["__proto__=a;__proto__=b", { ["__proto__"]: ["a", "b"] }],
    ["", {}],
  ])("collects values from %s", (header, expected) => {
    expect(parse(header, { allowMultiple: true })).toEqual(expected);
  });

  it("keeps the first value when disabled", () => {
    expect(parse("foo=;foo=b", { allowMultiple: false })).toEqual({ foo: "" });
  });

  it("supports custom decoding and filtering", () => {
    expect(
      parse("foo=a;bar=x;foo=b;bar=y", {
        allowMultiple: true,
        decode: (value) => value.toUpperCase(),
        filter: (key) => key === "foo",
      }),
    ).toEqual({ foo: ["A", "B"] });
  });

  it("preserves undefined decoder behavior", () => {
    expect(
      parse("foo=skip;foo=a;foo=skip;foo=b", {
        allowMultiple: true,
        decode: (value) => (value === "skip" ? undefined : value),
      }),
    ).toEqual({ foo: ["a", "b"] });
  });

  it("infers return types from options", () => {
    expectTypeOf(parse("").foo).toEqualTypeOf<string | undefined>();
    expectTypeOf(parse("", { allowMultiple: false }).foo).toEqualTypeOf<string | undefined>();
    expectTypeOf(parse("", { allowMultiple: true }).foo).toEqualTypeOf<
      string | string[] | undefined
    >();
    const options: import("../src").CookieParseOptions = {};
    expectTypeOf(parse("", options).foo).toEqualTypeOf<string | string[] | undefined>();
  });
});
