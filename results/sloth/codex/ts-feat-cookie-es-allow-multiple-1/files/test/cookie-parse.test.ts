// Based on https://github.com/jshttp/cookie (MIT)
// Copyright (c) 2012-2014 Roman Shtylman <shtylman@gmail.com>
// Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
// Last sync: e264dfa

import { describe, it, expect, expectTypeOf } from "vitest";
import { parse } from "../src";
import type { CookieParseOptions, Cookies } from "../src";

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
  it("should preserve duplicate values only when allowMultiple is enabled", () => {
    const cookies = parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true });
    expect(cookies).toEqual({ foo: ["a", "b", "c"], bar: "bar" });
    expect(parse("foo=;bar=bar;foo=boo", { allowMultiple: true })).toEqual({
      foo: ["", "boo"],
      bar: "bar",
    });
    expect(parse("foo=%1;foo=boo;foo=%20", { allowMultiple: true })).toEqual({
      foo: ["%1", "boo", " "],
    });
    expect(parse("", { allowMultiple: true })).toEqual({});
    expect(
      parse("foo=a;bar=bar;foo=b", {
        allowMultiple: true,
        decode: (value) => value.toUpperCase(),
        filter: (key) => key === "foo",
      }),
    ).toEqual({ foo: ["A", "B"] });
    expect(parse("foo=a;foo=b;foo=c", { allowMultiple: true, decode: () => undefined })).toEqual({
      foo: [undefined, undefined, undefined],
    });
    expect(parse("__proto__=a;__proto__=b", { allowMultiple: true })["__proto__"]).toEqual([
      "a",
      "b",
    ]);
    expect(parse("foo=a;foo=b", { allowMultiple: false })).toEqual({ foo: "a" });

    expectTypeOf(cookies).toEqualTypeOf<Cookies<true>>();
    expectTypeOf(parse("foo=a")).toEqualTypeOf<Cookies>();
    expectTypeOf(parse("foo=a", { allowMultiple: false })).toEqualTypeOf<Cookies>();
    const options: CookieParseOptions = { allowMultiple: true };
    expectTypeOf(parse("foo=a", options)).toEqualTypeOf<Cookies<boolean>>();
  });

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
