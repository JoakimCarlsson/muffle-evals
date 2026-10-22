# ts-feat-cookie-es-allow-multiple

Source: https://github.com/unjs/cookie-es/pull/55

## Prompt

> When a request has the same cookie name more than once, `parse()` from cookie-es only keeps the first value and silently drops the rest. Some of our upstream proxies set duplicate cookies and I need to see all of them.
> 
> Could `parse()` take an `allowMultiple` option in its options object? With `allowMultiple: true`, a name that appears more than once should map to an array of all its values in order, while names that appear once stay plain strings:
> 
> ```ts
> parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true });
> // => { foo: ["a", "b", "c"], bar: "bar" }
> 
> parse("foo=;bar=bar;foo=boo", { allowMultiple: true });
> // => { foo: ["", "boo"], bar: "bar" }
> ```
> 
> Values should still be decoded the same way as today (e.g. `foo=%1;foo=boo` gives `["%1", "boo"]`). Without the option, behaviour stays as it is: first value wins. It would be nice if the return type reflected that values can be arrays when the option is on.
> 
> Please add this.

## Upstream change (tests left out)

Files: [README.md](../../tasks/ts-feat-cookie-es-allow-multiple/upstream/README.md), [src/cookie/parse.ts](../../tasks/ts-feat-cookie-es-allow-multiple/upstream/src/cookie/parse.ts), [src/cookie/types.ts](../../tasks/ts-feat-cookie-es-allow-multiple/upstream/src/cookie/types.ts), [src/index.ts](../../tasks/ts-feat-cookie-es-allow-multiple/upstream/src/index.ts), [test/cookie-parse.test.ts](../../tasks/ts-feat-cookie-es-allow-multiple/upstream/test/cookie-parse.test.ts), [test/cookie-serialize.test.ts](../../tasks/ts-feat-cookie-es-allow-multiple/upstream/test/cookie-serialize.test.ts)

```diff
diff --git a/README.md b/README.md
index 0644a07..72fa72b 100644
--- a/README.md
+++ b/README.md
@@ -35,6 +35,24 @@ import { parse, serialize, parseSetCookie, splitSetCookieString } from "cookie-e
 import { parse, serialize, parseSetCookie, splitSetCookieString } from "https://esm.sh/cookie-es";
 ```
 
+## Parsing Options
+
+### `allowMultiple`
+
+By default, when a cookie name appears more than once, only the first value is kept. Set `allowMultiple: true` to collect all values into an array:
+
+```js
+import { parse } from "cookie-es";
+
+// Default: first value wins
+parse("foo=a;bar=b;foo=c");
+// => { foo: "a", bar: "b" }
+
+// With allowMultiple: duplicates return arrays
+parse("foo=a;bar=b;foo=c", { allowMultiple: true });
+// => { foo: ["a", "c"], bar: "b" }
+```
+
 ## License
 
 [MIT](./LICENSE)
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..7974664 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -3,7 +3,7 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: v1.1.1 (e264dfa)
 
-import type { CookieParseOptions, Cookies, SetCookie } from "./types.ts";
+import type { CookieParseOptions, Cookies, MultiCookies, SetCookie } from "./types.ts";
 
 /**
  * RegExp to match max-age-value in RFC 6265 sec 5.6.2
@@ -22,13 +22,19 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse the given cookie header string into an object
  * The object has the various cookies as keys(names) => values
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse(
+  str: string,
+  options: CookieParseOptions & { allowMultiple: true },
+): MultiCookies;
+export function parse(str: string, options?: CookieParseOptions): Cookies;
+export function parse(str: string, options?: CookieParseOptions): Cookies | MultiCookies {
+  const obj: MultiCookies = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
 
   const dec = options?.decode || decode;
+  const allowMultiple = options?.allowMultiple || false;
   let index = 0;
 
   do {
@@ -50,9 +56,19 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
-      obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
+    const val = dec(valueSlice(str, eqIdx + 1, endIdx));
+
+    if (allowMultiple) {
+      const existing = obj[key];
+      if (existing === undefined) {
+        obj[key] = val;
+      } else if (Array.isArray(existing)) {
+        existing.push(val!);
+      } else {
+        obj[key] = [existing!, val!];
+      }
+    } else if (obj[key] === undefined) {
+      obj[key] = val;
     }
 
     index = endIdx + 1;
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..291ad8f 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -23,6 +23,12 @@ export interface CookieParseOptions {
    * Custom function to filter parsing specific keys.
    */
   filter?(key: string): boolean;
+
+  /**
+   * When enabled, duplicate cookie names will return an array of values
+   * instead of only the first value.
+   */
+  allowMultiple?: boolean;
 }
 
 /**
@@ -30,6 +36,11 @@ export interface CookieParseOptions {
  */
 export type Cookies = Record<string, string | undefined>;
 
+/**
+ * Cookies object when `allowMultiple` is enabled.
+ */
+export type MultiCookies = Record<string, string | string[] | undefined>;
+
 /**
  * Stringify options.
  */
diff --git a/src/index.ts b/src/index.ts
index bbb51ce..3387c23 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -6,6 +6,7 @@ export type {
   CookieSerializeOptions,
   CookieStringifyOptions,
   Cookies,
+  MultiCookies,
   SetCookie,
 } from "./cookie/types.ts";
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +33/-7 | 21 | 2,450 | $0.111 |
| claude | muffle | pass | +31/-6 | 8 | 2,616 | $0.088 |
| claude | hush | pass | +28/-6 | 18 | 2,123 | $0.096 |
| claude | sloth | pass | +28/-5 | 0 | 2,483 | $0.106 |
| claude | all | pass | +28/-5 | 0 | 1,934 | $0.092 |
| codex | base | pass | +36/-5 | 47 | 2,020 | - |
| codex | muffle | pass | +34/-5 | 58 | 2,436 | - |
| codex | hush | pass | +36/-5 | 44 | 1,865 | - |
| codex | sloth | pass | +44/-5 | 0 | 2,288 | - |
| codex | all | pass | +34/-5 | 0 | 2,062 | - |

### claude, base: pass

Files: [src/cookie/parse.ts](../base/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../base/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [src/index.ts](../base/claude/ts-feat-cookie-es-allow-multiple-1/files/src/index.ts), [test/cookie-parse.test.ts](../base/claude/ts-feat-cookie-es-allow-multiple-1/files/test/cookie-parse.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..4dc2213 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -3,7 +3,7 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: v1.1.1 (e264dfa)
 
-import type { CookieParseOptions, Cookies, SetCookie } from "./types.ts";
+import type { CookieParseOptions, Cookies, MultiCookies, SetCookie } from "./types.ts";
 
 /**
  * RegExp to match max-age-value in RFC 6265 sec 5.6.2
@@ -20,10 +20,18 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse a `Cookie` header.
  *
  * Parse the given cookie header string into an object
- * The object has the various cookies as keys(names) => values
+ * The object has the various cookies as keys(names) => values.
+ *
+ * By default the first value wins for duplicate names. With `allowMultiple: true`, names that
+ * appear more than once map to an array of all their values in order.
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse(
+  str: string,
+  options: CookieParseOptions & { allowMultiple: true },
+): MultiCookies;
+export function parse(str: string, options?: CookieParseOptions): Cookies;
+export function parse(str: string, options?: CookieParseOptions): Cookies | MultiCookies {
+  const obj: MultiCookies = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,9 +58,13 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
-      obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
+    const value = dec(valueSlice(str, eqIdx + 1, endIdx));
+    const existing = obj[key];
+    if (existing === undefined) {
+      obj[key] = value;
+    } else if (options?.allowMultiple && value !== undefined) {
+      if (Array.isArray(existing)) existing.push(value);
+      else obj[key] = [existing, value];
     }
 
     index = endIdx + 1;
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..e87ac06 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -23,6 +23,14 @@ export interface CookieParseOptions {
    * Custom function to filter parsing specific keys.
    */
   filter?(key: string): boolean;
+
+  /**
+   * When a cookie name appears more than once, collect all values (in order) into an array
+   * instead of keeping only the first. Names that appear once stay plain strings.
+   *
+   * @default false
+   */
+  allowMultiple?: boolean;
 }
 
 /**
@@ -30,6 +38,11 @@ export interface CookieParseOptions {
  */
 export type Cookies = Record<string, string | undefined>;
 
+/**
+ * Cookies object returned when `allowMultiple` is enabled.
+ */
+export type MultiCookies = Record<string, string | string[] | undefined>;
+
 /**
  * Stringify options.
  */
diff --git a/src/index.ts b/src/index.ts
index bbb51ce..3387c23 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -6,6 +6,7 @@ export type {
   CookieSerializeOptions,
   CookieStringifyOptions,
   Cookies,
+  MultiCookies,
   SetCookie,
 } from "./cookie/types.ts";
 
diff --git a/test/cookie-parse.test.ts b/test/cookie-parse.test.ts
index 30228ee..aa60cc7 100644
--- a/test/cookie-parse.test.ts
+++ b/test/cookie-parse.test.ts
@@ -80,3 +80,24 @@ describe("cookie.parse(str, options)", () => {
     });
   });
 });
+
+describe("cookie.parse(str, { allowMultiple })", () => {
+  it("should collect duplicate names into arrays", () => {
+    expect(parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true })).toEqual({
+      foo: ["a", "b", "c"],
+      bar: "bar",
+    });
+    expect(parse("foo=;bar=bar;foo=boo", { allowMultiple: true })).toEqual({
+      foo: ["", "boo"],
+      bar: "bar",
+    });
+  });
+
+  it("should decode values", () => {
+    expect(parse("foo=%1;foo=boo", { allowMultiple: true })).toEqual({ foo: ["%1", "boo"] });
+  });
+
+  it("should keep first value by default", () => {
+    expect(parse("foo=a;foo=b")).toEqual({ foo: "a" });
+  });
+});
```

</details>

<details><summary>reply</summary>

Export the new type; the tsc error is a pre-existing config issue, so I'll check types with the flag silenced.

`parse()` now accepts `allowMultiple: true`. The test suite passes (100 tests), and `tsc` reports no errors in `src/` or in `test/cookie-parse.test.ts`. The type-check needed `--ignoreDeprecations 6.0`, because the repo's `tsconfig.json` has a deprecated `esModuleInterop=false` setting that stops plain `tsc` before it checks anything. `tsc` also reports errors in `test/split-cookies-string.test.ts`; I didn't touch that file.

- **Behaviour:** both of your examples give the results you listed, including `foo=%1;foo=boo` → `["%1", "boo"]`. Names that appear once stay plain strings. Without the option, the first value still wins.
- **Return type:** an overload makes `parse(str, { allowMultiple: true })` return a new `MultiCookies` type, `Record<string, string | string[] | undefined>`. Other calls still return `Cookies`. `MultiCookies` is exported from `src/index.ts`.
- **Undefined from `decode`:** a custom `decode` can return `undefined`. With the option on, those values are left out of the array rather than pushed in.
- **Tests:** I added tests for your two examples, the decoding case and the default first-wins behaviour.

The changes are in `src/cookie/parse.ts`, `src/cookie/types.ts`, `src/index.ts` and `test/cookie-parse.test.ts`. I haven't committed anything.

</details>

### claude, muffle: pass

Files: [src/cookie/parse.ts](../muffle/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../muffle/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [src/index.ts](../muffle/claude/ts-feat-cookie-es-allow-multiple-1/files/src/index.ts), [test/cookie-parse.test.ts](../muffle/claude/ts-feat-cookie-es-allow-multiple-1/files/test/cookie-parse.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..943d3cf 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -3,7 +3,7 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: v1.1.1 (e264dfa)
 
-import type { CookieParseOptions, Cookies, SetCookie } from "./types.ts";
+import type { CookieParseOptions, Cookies, MultiCookies, SetCookie } from "./types.ts";
 
 /**
  * RegExp to match max-age-value in RFC 6265 sec 5.6.2
@@ -20,10 +20,17 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse a `Cookie` header.
  *
  * Parse the given cookie header string into an object
- * The object has the various cookies as keys(names) => values
+ * The object has the various cookies as keys(names) => values.
+ * By default the first value of a repeated name wins; with `allowMultiple`
+ * repeated names map to an array of all their values in order.
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse(
+  str: string,
+  options: CookieParseOptions & { allowMultiple: true },
+): MultiCookies;
+export function parse(str: string, options?: CookieParseOptions): Cookies;
+export function parse(str: string, options?: CookieParseOptions): Cookies | MultiCookies {
+  const obj: MultiCookies = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,9 +57,13 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
+    const existing = obj[key];
+    if (existing === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
+    } else if (options?.allowMultiple) {
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx)) as string;
+      if (Array.isArray(existing)) existing.push(value);
+      else obj[key] = [existing, value];
     }
 
     index = endIdx + 1;
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..51caeac 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -23,6 +23,14 @@ export interface CookieParseOptions {
    * Custom function to filter parsing specific keys.
    */
   filter?(key: string): boolean;
+
+  /**
+   * When `true`, a cookie name that appears more than once maps to an array of all its values (in order).
+   * Names that appear once stay plain strings. By default only the first value is kept.
+   *
+   * @default false
+   */
+  allowMultiple?: boolean;
 }
 
 /**
@@ -30,6 +38,11 @@ export interface CookieParseOptions {
  */
 export type Cookies = Record<string, string | undefined>;
 
+/**
+ * Cookies object where repeated names may map to an array of values (`allowMultiple`).
+ */
+export type MultiCookies = Record<string, string | string[] | undefined>;
+
 /**
  * Stringify options.
  */
diff --git a/src/index.ts b/src/index.ts
index bbb51ce..3387c23 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -6,6 +6,7 @@ export type {
   CookieSerializeOptions,
   CookieStringifyOptions,
   Cookies,
+  MultiCookies,
   SetCookie,
 } from "./cookie/types.ts";
 
diff --git a/test/cookie-parse.test.ts b/test/cookie-parse.test.ts
index 30228ee..d0ba65f 100644
--- a/test/cookie-parse.test.ts
+++ b/test/cookie-parse.test.ts
@@ -69,6 +69,14 @@ describe("cookie.parse(str, options)", () => {
       ).toMatchObject({ foo: "bar" });
     });
 
+    it("allowMultiple collects repeated names", () => {
+      const o = { allowMultiple: true } as const;
+      expect(parse("foo=a;bar=bar;foo=b;foo=c", o)).toEqual({ foo: ["a", "b", "c"], bar: "bar" });
+      expect(parse("foo=;bar=bar;foo=boo", o)).toEqual({ foo: ["", "boo"], bar: "bar" });
+      expect(parse("foo=%1;foo=boo", o)).toEqual({ foo: ["%1", "boo"] });
+      expect(parse("foo=a;foo=b")).toEqual({ foo: "a" });
+    });
+
     it("parse filter key", () => {
       expect(
         parse("a=1;b=2", {
```

</details>

<details><summary>reply</summary>

`parse()` now takes `allowMultiple`. All 98 tests pass, including a new one for the option. `tsc --noEmit` reports one error, a TS5107 deprecation warning about `esModuleInterop` in `tsconfig.json`. I didn't touch that file, so it was already there.

- **With `allowMultiple: true`:** a name that appears more than once maps to an array of all its values in order, and a name that appears once stays a plain string. Your two examples and `foo=%1;foo=boo` give `["%1", "boo"]`. Values are decoded the same way as before, including with a custom `decode`.
- **Without the option:** nothing changes, and the first value still wins.
- **Types:** `parse(str, { allowMultiple: true })` returns a new `MultiCookies` type, where each value can be a `string` or `string[]`. Any other call still returns `Cookies`. I exported `MultiCookies` from `src/index.ts`.
- **Where:** the changes are in `src/cookie/parse.ts` and `src/cookie/types.ts`, with the test in `test/cookie-parse.test.ts`.

I didn't commit anything.

</details>

### claude, hush: pass

Files: [src/cookie/parse.ts](../hush/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../hush/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [src/index.ts](../hush/claude/ts-feat-cookie-es-allow-multiple-1/files/src/index.ts), [test/cookie-parse.test.ts](../hush/claude/ts-feat-cookie-es-allow-multiple-1/files/test/cookie-parse.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..459daf6 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -3,7 +3,7 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: v1.1.1 (e264dfa)
 
-import type { CookieParseOptions, Cookies, SetCookie } from "./types.ts";
+import type { CookieParseOptions, Cookies, MultiCookies, SetCookie } from "./types.ts";
 
 /**
  * RegExp to match max-age-value in RFC 6265 sec 5.6.2
@@ -20,10 +20,14 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse a `Cookie` header.
  *
  * Parse the given cookie header string into an object
- * The object has the various cookies as keys(names) => values
+ * The object has the various cookies as keys(names) => values.
+ * By default the first value of a repeated name wins; with `allowMultiple`
+ * repeated names map to an array of all values in order.
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse(str: string, options: CookieParseOptions & { allowMultiple: true }): MultiCookies;
+export function parse(str: string, options?: CookieParseOptions): Cookies;
+export function parse(str: string, options?: CookieParseOptions): Cookies | MultiCookies {
+  const obj: MultiCookies = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,9 +54,13 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
+    const existing = obj[key];
+    if (existing === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
+    } else if (options?.allowMultiple) {
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx));
+      if (Array.isArray(existing)) existing.push(value);
+      else obj[key] = [existing, value];
     }
 
     index = endIdx + 1;
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..7bbe231 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -23,6 +23,14 @@ export interface CookieParseOptions {
    * Custom function to filter parsing specific keys.
    */
   filter?(key: string): boolean;
+
+  /**
+   * When a cookie name appears more than once, collect all values into an array (in order)
+   * instead of keeping only the first. Names that appear once stay plain strings.
+   *
+   * @default false
+   */
+  allowMultiple?: boolean;
 }
 
 /**
@@ -30,6 +38,11 @@ export interface CookieParseOptions {
  */
 export type Cookies = Record<string, string | undefined>;
 
+/**
+ * Cookies object when `allowMultiple` is enabled.
+ */
+export type MultiCookies = Record<string, string | string[] | undefined>;
+
 /**
  * Stringify options.
  */
diff --git a/src/index.ts b/src/index.ts
index bbb51ce..3387c23 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -6,6 +6,7 @@ export type {
   CookieSerializeOptions,
   CookieStringifyOptions,
   Cookies,
+  MultiCookies,
   SetCookie,
 } from "./cookie/types.ts";
 
diff --git a/test/cookie-parse.test.ts b/test/cookie-parse.test.ts
index 30228ee..82b2764 100644
--- a/test/cookie-parse.test.ts
+++ b/test/cookie-parse.test.ts
@@ -80,3 +80,21 @@ describe("cookie.parse(str, options)", () => {
     });
   });
 });
+
+describe("parse allowMultiple", () => {
+  it("collects duplicates in order", () => {
+    expect(parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true })).toEqual({
+      foo: ["a", "b", "c"],
+      bar: "bar",
+    });
+    expect(parse("foo=;bar=bar;foo=boo", { allowMultiple: true })).toEqual({
+      foo: ["", "boo"],
+      bar: "bar",
+    });
+    expect(parse("foo=%1;foo=boo", { allowMultiple: true })).toEqual({ foo: ["%1", "boo"] });
+  });
+
+  it("keeps first value by default", () => {
+    expect(parse("foo=a;foo=b")).toEqual({ foo: "a" });
+  });
+});
```

</details>

<details><summary>reply</summary>

Done. `parse()` now takes `allowMultiple`. Repeated names become ordered arrays and single names stay strings. Return type is `MultiCookies` when the option is `true`. All 99 tests pass, including new ones. `tsc` only reports an existing `esModuleInterop` config error.

</details>

### claude, sloth: pass

Files: [src/cookie/parse.ts](../sloth/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../sloth/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [src/index.ts](../sloth/claude/ts-feat-cookie-es-allow-multiple-1/files/src/index.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..9d970e4 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -3,7 +3,7 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: v1.1.1 (e264dfa)
 
-import type { CookieParseOptions, Cookies, SetCookie } from "./types.ts";
+import type { CookieParseOptions, Cookies, MultiCookies, SetCookie } from "./types.ts";
 
 /**
  * RegExp to match max-age-value in RFC 6265 sec 5.6.2
@@ -22,8 +22,13 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse the given cookie header string into an object
  * The object has the various cookies as keys(names) => values
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse(
+  str: string,
+  options: CookieParseOptions & { allowMultiple: true },
+): MultiCookies;
+export function parse(str: string, options?: CookieParseOptions): Cookies;
+export function parse(str: string, options?: CookieParseOptions): MultiCookies {
+  const obj: MultiCookies = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,9 +55,13 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
+    const existing = obj[key];
+    if (existing === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
+    } else if (options?.allowMultiple) {
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx)) as string;
+      if (Array.isArray(existing)) existing.push(value);
+      else obj[key] = [existing, value];
     }
 
     index = endIdx + 1;
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..e8fe1f8 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -23,6 +23,14 @@ export interface CookieParseOptions {
    * Custom function to filter parsing specific keys.
    */
   filter?(key: string): boolean;
+
+  /**
+   * Collect every value of a repeated cookie name into an array (in order) instead of keeping only the first.
+   * Names that appear once stay plain strings.
+   *
+   * @default false
+   */
+  allowMultiple?: boolean;
 }
 
 /**
@@ -30,6 +38,11 @@ export interface CookieParseOptions {
  */
 export type Cookies = Record<string, string | undefined>;
 
+/**
+ * Cookies object where repeated names map to arrays of values.
+ */
+export type MultiCookies = Record<string, string | string[] | undefined>;
+
 /**
  * Stringify options.
  */
diff --git a/src/index.ts b/src/index.ts
index bbb51ce..3387c23 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -6,6 +6,7 @@ export type {
   CookieSerializeOptions,
   CookieStringifyOptions,
   Cookies,
+  MultiCookies,
   SetCookie,
 } from "./cookie/types.ts";
```

</details>

<details><summary>reply</summary>

Exporting the new `MultiCookies` type from the index, then I'll finish checking.

`parse()` now takes `allowMultiple: true`. With it, a name that appears more than once maps to an array of its values in order, and names that appear once stay plain strings.

I ran your three examples plus a no-option case, and all four gave the results you listed:
- `foo=a;bar=bar;foo=b;foo=c` gives `{ foo: ["a", "b", "c"], bar: "bar" }`.
- `foo=;bar=bar;foo=boo` gives `{ foo: ["", "boo"], bar: "bar" }`.
- `foo=%1;foo=boo` gives `["%1", "boo"]`, so decoding is unchanged.
- `foo=a;foo=b` without the option still gives `{ foo: "a" }`.

I ran those through a throwaway test file that I deleted afterwards, so I added no permanent tests. The existing 97 tests pass. A type-check shows no errors in `src/`; it does report errors in `test/split-cookies-string.test.ts`, which I didn't change.

For the return type, `parse()` has an overload that returns a new `MultiCookies` type (`Record<string, string | string[] | undefined>`) when `allowMultiple: true`. Without the option it still returns `Cookies`, so existing callers see no change. I exported `MultiCookies` from `src/index.ts`.

The changes are in `src/cookie/parse.ts`, `src/cookie/types.ts` and `src/index.ts`, and nothing is committed.

</details>

### claude, all: pass

Files: [src/cookie/parse.ts](../all/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../all/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [src/index.ts](../all/claude/ts-feat-cookie-es-allow-multiple-1/files/src/index.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..81f8bb6 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -3,7 +3,7 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: v1.1.1 (e264dfa)
 
-import type { CookieParseOptions, Cookies, SetCookie } from "./types.ts";
+import type { CookieParseOptions, Cookies, MultiCookies, SetCookie } from "./types.ts";
 
 /**
  * RegExp to match max-age-value in RFC 6265 sec 5.6.2
@@ -22,8 +22,13 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse the given cookie header string into an object
  * The object has the various cookies as keys(names) => values
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse(
+  str: string,
+  options: CookieParseOptions & { allowMultiple: true },
+): MultiCookies;
+export function parse(str: string, options?: CookieParseOptions): Cookies;
+export function parse(str: string, options?: CookieParseOptions): MultiCookies {
+  const obj: MultiCookies = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,9 +55,13 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
+    const existing = obj[key];
+    if (existing === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
+    } else if (options?.allowMultiple) {
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx));
+      if (Array.isArray(existing)) existing.push(value);
+      else obj[key] = [existing, value];
     }
 
     index = endIdx + 1;
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..5483177 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -23,6 +23,14 @@ export interface CookieParseOptions {
    * Custom function to filter parsing specific keys.
    */
   filter?(key: string): boolean;
+
+  /**
+   * Collect every value of a repeated cookie name into an array, in order.
+   * Names that appear once stay plain strings. By default only the first value is kept.
+   *
+   * @default false
+   */
+  allowMultiple?: boolean;
 }
 
 /**
@@ -30,6 +38,11 @@ export interface CookieParseOptions {
  */
 export type Cookies = Record<string, string | undefined>;
 
+/**
+ * Cookies object where repeated names map to arrays of values.
+ */
+export type MultiCookies = Record<string, string | undefined | (string | undefined)[]>;
+
 /**
  * Stringify options.
  */
diff --git a/src/index.ts b/src/index.ts
index bbb51ce..3387c23 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -6,6 +6,7 @@ export type {
   CookieSerializeOptions,
   CookieStringifyOptions,
   Cookies,
+  MultiCookies,
   SetCookie,
 } from "./cookie/types.ts";
```

</details>

<details><summary>reply</summary>

Done. `parse()` now takes `allowMultiple`. Repeated names become arrays in order, single names stay strings, and decoding is unchanged. An overload returns the new `MultiCookies` type (exported) when `allowMultiple: true`. Existing tests pass (97). I didn't add tests or run your examples. `tsc` fails on a tsconfig `esModuleInterop` deprecation, so the types are unchecked.

</details>

### codex, base: pass

Files: [README.md](../base/codex/ts-feat-cookie-es-allow-multiple-1/files/README.md), [src/cookie/parse.ts](../base/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../base/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [test/cookie-parse.test.ts](../base/codex/ts-feat-cookie-es-allow-multiple-1/files/test/cookie-parse.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 0644a07..878f108 100644
--- a/README.md
+++ b/README.md
@@ -35,6 +35,14 @@ import { parse, serialize, parseSetCookie, splitSetCookieString } from "cookie-e
 import { parse, serialize, parseSetCookie, splitSetCookieString } from "https://esm.sh/cookie-es";
 ```
 
+Use `allowMultiple` to keep duplicate cookie values in header order. Names that occur
+once remain strings. By default, the first value wins.
+
+```js
+parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true });
+// { foo: ["a", "b", "c"], bar: "bar" }
+```
+
 ## License
 
 [MIT](./LICENSE)
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..8d65cf5 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -22,8 +22,14 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse the given cookie header string into an object
  * The object has the various cookies as keys(names) => values
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse(
+  str: string,
+  options?: CookieParseOptions & { allowMultiple?: false },
+): Cookies;
+export function parse(str: string, options: CookieParseOptions): Cookies<true>;
+export function parse(str: string, options?: CookieParseOptions): Cookies<boolean>;
+export function parse(str: string, options?: CookieParseOptions): Cookies<boolean> {
+  const obj: Cookies<boolean> = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,8 +56,15 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
+    if (options?.allowMultiple && Object.hasOwn(obj, key)) {
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx));
+      const previous = obj[key];
+      if (Array.isArray(previous)) {
+        previous.push(value);
+      } else {
+        obj[key] = [previous, value];
+      }
+    } else if (obj[key] === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
     }
 
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..3f0cd83 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -6,6 +6,13 @@
  * Parse options.
  */
 export interface CookieParseOptions {
+  /**
+   * Preserve duplicate cookie values in arrays, in header order.
+   * Names that occur once remain single values.
+   * @default false
+   */
+  allowMultiple?: boolean;
+
   /**
    * Specifies a function that will be used to decode a [cookie-value](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1.1).
    * Since the value of a cookie has a limited character set (and must be a simple string), this function can be used to decode
@@ -28,7 +35,10 @@ export interface CookieParseOptions {
 /**
  * Cookies object.
  */
-export type Cookies = Record<string, string | undefined>;
+export type Cookies<AllowMultiple extends boolean = false> = Record<
+  string,
+  string | undefined | (AllowMultiple extends false ? never : (string | undefined)[])
+>;
 
 /**
  * Stringify options.
diff --git a/test/cookie-parse.test.ts b/test/cookie-parse.test.ts
index 30228ee..d5d8a73 100644
--- a/test/cookie-parse.test.ts
+++ b/test/cookie-parse.test.ts
@@ -3,7 +3,7 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: e264dfa
 
-import { describe, it, expect } from "vitest";
+import { describe, it, expect, expectTypeOf } from "vitest";
 import { parse } from "../src";
 
 describe("cookie.parse(str)", () => {
@@ -80,3 +80,49 @@ describe("cookie.parse(str, options)", () => {
     });
   });
 });
+
+describe('with "allowMultiple" option', () => {
+  it("preserves duplicate values in order and single values as strings", () => {
+    expect(parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true })).toEqual({
+      foo: ["a", "b", "c"],
+      bar: "bar",
+    });
+    expect(parse("foo=;bar=bar;foo=boo", { allowMultiple: true })).toEqual({
+      foo: ["", "boo"],
+      bar: "bar",
+    });
+    expect(parse("foo=a;foo=b", { allowMultiple: false })).toEqual({ foo: "a" });
+  });
+
+  it("decodes each value and preserves malformed escapes", () => {
+    expect(parse("foo=%1;foo=boo;foo=%20", { allowMultiple: true })).toEqual({
+      foo: ["%1", "boo", " "],
+    });
+    expect(
+      parse("foo=a;foo=b;bar=c", {
+        allowMultiple: true,
+        decode: (value) => value.toUpperCase(),
+        filter: (key) => key === "foo",
+      }),
+    ).toEqual({ foo: ["A", "B"] });
+  });
+
+  it("preserves undefined decoder results and handles prototype names", () => {
+    expect(parse("foo=a;foo=b", { allowMultiple: true, decode: () => undefined })).toEqual({
+      foo: [undefined, undefined],
+    });
+    const cookies = parse("__proto__=a;__proto__=b;constructor=c;constructor=d", {
+      allowMultiple: true,
+    });
+    expect(cookies.__proto__).toEqual(["a", "b"]);
+    expect(cookies.constructor).toEqual(["c", "d"]);
+  });
+
+  it("reflects the option in return types", () => {
+    expectTypeOf(parse("foo=a").foo).toEqualTypeOf<string | undefined>();
+    expectTypeOf(parse("foo=a", { allowMultiple: false }).foo).toEqualTypeOf<string | undefined>();
+    expectTypeOf(parse("foo=a", { allowMultiple: true }).foo).toEqualTypeOf<
+      string | undefined | (string | undefined)[]
+    >();
+  });
+});
```

</details>

<details><summary>reply</summary>

I’ll check the parser and tests, add `allowMultiple` with matching return types, and verify that the default behavior stays unchanged.

The parser now collects duplicate values in order when `allowMultiple` is enabled. I’ve added tests for empty values, decoding, filtering, and return types. Since `pnpm` isn’t available here, I’m running the installed check tools directly.

Added `allowMultiple: true` with ordered arrays for duplicate names, strings for single values, and matching TypeScript return types. Default first-value behavior is unchanged.

All 101 tests pass; build and lint pass. Full formatting and type checks encounter existing issues in unrelated tests and TypeScript configuration.

</details>

### codex, muffle: pass

Files: [README.md](../muffle/codex/ts-feat-cookie-es-allow-multiple-1/files/README.md), [src/cookie/parse.ts](../muffle/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../muffle/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [test/cookie-parse.test.ts](../muffle/codex/ts-feat-cookie-es-allow-multiple-1/files/test/cookie-parse.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 0644a07..8a29fbe 100644
--- a/README.md
+++ b/README.md
@@ -35,6 +35,14 @@ import { parse, serialize, parseSetCookie, splitSetCookieString } from "cookie-e
 import { parse, serialize, parseSetCookie, splitSetCookieString } from "https://esm.sh/cookie-es";
 ```
 
+To collect duplicate cookie values in order, enable `allowMultiple`. Names that
+appear once keep a single string value. By default, the first value wins.
+
+```js
+parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true });
+// { foo: ["a", "b", "c"], bar: "bar" }
+```
+
 ## License
 
 [MIT](./LICENSE)
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..4dbc438 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -22,8 +22,12 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse the given cookie header string into an object
  * The object has the various cookies as keys(names) => values
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse<AllowMultiple extends boolean = false>(
+  str: string,
+  options?: CookieParseOptions & { allowMultiple?: AllowMultiple },
+): Cookies<AllowMultiple>;
+export function parse(str: string, options?: CookieParseOptions): Cookies<boolean> {
+  const obj: Cookies<boolean> = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,8 +54,15 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
+    if (options?.allowMultiple && key in obj) {
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx));
+      const previous = obj[key];
+      if (Array.isArray(previous)) {
+        previous.push(value);
+      } else {
+        obj[key] = [previous, value];
+      }
+    } else if (obj[key] === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
     }
 
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..78dc52f 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -6,6 +6,13 @@
  * Parse options.
  */
 export interface CookieParseOptions {
+  /**
+   * Collect duplicate cookie values in order. Single values remain strings.
+   *
+   * @default false
+   */
+  allowMultiple?: boolean;
+
   /**
    * Specifies a function that will be used to decode a [cookie-value](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1.1).
    * Since the value of a cookie has a limited character set (and must be a simple string), this function can be used to decode
@@ -28,7 +35,10 @@ export interface CookieParseOptions {
 /**
  * Cookies object.
  */
-export type Cookies = Record<string, string | undefined>;
+export type Cookies<AllowMultiple extends boolean = false> = Record<
+  string,
+  string | undefined | (AllowMultiple extends true ? (string | undefined)[] : never)
+>;
 
 /**
  * Stringify options.
diff --git a/test/cookie-parse.test.ts b/test/cookie-parse.test.ts
index 30228ee..e5ae124 100644
--- a/test/cookie-parse.test.ts
+++ b/test/cookie-parse.test.ts
@@ -3,8 +3,9 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: e264dfa
 
-import { describe, it, expect } from "vitest";
+import { describe, it, expect, expectTypeOf } from "vitest";
 import { parse } from "../src";
+import type { CookieParseOptions, Cookies } from "../src";
 
 describe("cookie.parse(str)", () => {
   it("should return empty object for empty string", () => {
@@ -58,6 +59,62 @@ describe("cookie.parse(str)", () => {
 });
 
 describe("cookie.parse(str, options)", () => {
+  describe('with "allowMultiple" option', () => {
+    it("should collect duplicates in order and keep single values as strings", () => {
+      expect(parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true })).toEqual({
+        foo: ["a", "b", "c"],
+        bar: "bar",
+      });
+      expect(parse("", { allowMultiple: true })).toEqual({});
+    });
+
+    it("should preserve empty values and decode every value", () => {
+      expect(parse("foo=;bar=bar;foo=boo;foo=", { allowMultiple: true })).toEqual({
+        foo: ["", "boo", ""],
+        bar: "bar",
+      });
+      expect(parse("foo=%1;foo=boo;foo=%20", { allowMultiple: true })).toEqual({
+        foo: ["%1", "boo", " "],
+      });
+    });
+
+    it("should respect custom decoders and filters", () => {
+      expect(
+        parse("foo=a;bar=b;foo=c;bar=d", {
+          allowMultiple: true,
+          decode: (value) => value.toUpperCase(),
+          filter: (key) => key === "foo",
+        }),
+      ).toEqual({ foo: ["A", "C"] });
+      expect(
+        parse("foo=a;foo=b;foo=c", {
+          allowMultiple: true,
+          decode: (value) => (value === "b" ? value : undefined),
+        }),
+      ).toEqual({ foo: [undefined, "b", undefined] });
+    });
+
+    it("should handle names inherited by ordinary objects", () => {
+      expect(
+        parse("__proto__=a;__proto__=b;constructor=c;constructor=d", {
+          allowMultiple: true,
+        }),
+      ).toEqual({ ["__proto__"]: ["a", "b"], constructor: ["c", "d"] });
+    });
+
+    it("should keep the first value when disabled", () => {
+      expect(parse("foo=;foo=b", { allowMultiple: false })).toEqual({ foo: "" });
+    });
+
+    it("should infer return types from the option", () => {
+      expectTypeOf(parse("foo=a")).toEqualTypeOf<Cookies>();
+      expectTypeOf(parse("foo=a", { allowMultiple: false })).toEqualTypeOf<Cookies>();
+      expectTypeOf(parse("foo=a", { allowMultiple: true })).toEqualTypeOf<Cookies<true>>();
+      const options: CookieParseOptions = { allowMultiple: true };
+      expectTypeOf(parse("foo=a", options)).toEqualTypeOf<Cookies<boolean>>();
+    });
+  });
+
   describe('with "decode" option', () => {
     it("should specify alternative value decoder", () => {
       expect(
```

</details>

<details><summary>reply</summary>

I’ll check the parser and its types, add `allowMultiple`, and test that the default behavior stays unchanged.


The parser now collects duplicate values in order, and the return type reflects `allowMultiple`. I’ve added tests for empty values, decoding, filters, and types. Validation found a formatting issue in the unchanged serializer test; I’m continuing with the tests, type check, and build.


Added `allowMultiple` with inferred return types, documentation, and tests. Duplicate values become arrays in order; single values remain strings. Default behavior is unchanged.

All 103 tests pass, lint passes, and the build succeeds. Full formatting and type checks encounter existing issues in unrelated tests and TypeScript configuration; changed files pass formatting.

</details>

### codex, hush: pass

Files: [README.md](../hush/codex/ts-feat-cookie-es-allow-multiple-1/files/README.md), [src/cookie/parse.ts](../hush/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../hush/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [test/cookie-parse.test.ts](../hush/codex/ts-feat-cookie-es-allow-multiple-1/files/test/cookie-parse.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 0644a07..61ac6da 100644
--- a/README.md
+++ b/README.md
@@ -35,6 +35,14 @@ import { parse, serialize, parseSetCookie, splitSetCookieString } from "cookie-e
 import { parse, serialize, parseSetCookie, splitSetCookieString } from "https://esm.sh/cookie-es";
 ```
 
+Pass `allowMultiple: true` to preserve duplicate cookie values in order. Names that
+appear once remain strings. By default, the first value wins.
+
+```js
+parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true });
+// { foo: ["a", "b", "c"], bar: "bar" }
+```
+
 ## License
 
 [MIT](./LICENSE)
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..0d739d6 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -22,8 +22,12 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse the given cookie header string into an object
  * The object has the various cookies as keys(names) => values
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse<AllowMultiple extends boolean = false>(
+  str: string,
+  options?: CookieParseOptions & { allowMultiple?: AllowMultiple },
+): Cookies<AllowMultiple>;
+export function parse(str: string, options?: CookieParseOptions): Cookies<boolean> {
+  const obj: Cookies<boolean> = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,8 +54,16 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
+    // Preserve the first value unless duplicate values are requested.
+    const previous = obj[key];
+    if (options?.allowMultiple && Object.hasOwn(obj, key)) {
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx));
+      if (Array.isArray(previous)) {
+        previous.push(value);
+      } else {
+        obj[key] = [previous, value];
+      }
+    } else if (previous === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
     }
 
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..73a4dea 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -6,6 +6,14 @@
  * Parse options.
  */
 export interface CookieParseOptions {
+  /**
+   * Preserve duplicate cookie values in order as an array.
+   * Cookies that appear once remain strings.
+   *
+   * @default false
+   */
+  allowMultiple?: boolean;
+
   /**
    * Specifies a function that will be used to decode a [cookie-value](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1.1).
    * Since the value of a cookie has a limited character set (and must be a simple string), this function can be used to decode
@@ -28,7 +36,10 @@ export interface CookieParseOptions {
 /**
  * Cookies object.
  */
-export type Cookies = Record<string, string | undefined>;
+export type Cookies<AllowMultiple extends boolean = false> = Record<
+  string,
+  string | undefined | (true extends AllowMultiple ? (string | undefined)[] : never)
+>;
 
 /**
  * Stringify options.
diff --git a/test/cookie-parse.test.ts b/test/cookie-parse.test.ts
index 30228ee..10922a9 100644
--- a/test/cookie-parse.test.ts
+++ b/test/cookie-parse.test.ts
@@ -3,7 +3,7 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: e264dfa
 
-import { describe, it, expect } from "vitest";
+import { describe, it, expect, expectTypeOf } from "vitest";
 import { parse } from "../src";
 
 describe("cookie.parse(str)", () => {
@@ -80,3 +80,46 @@ describe("cookie.parse(str, options)", () => {
     });
   });
 });
+
+describe('with "allowMultiple" option', () => {
+  it.each([
+    ["foo=a;bar=bar;foo=b;foo=c", { foo: ["a", "b", "c"], bar: "bar" }],
+    ["foo=;bar=bar;foo=boo", { foo: ["", "boo"], bar: "bar" }],
+    ["foo=%1;foo=boo", { foo: ["%1", "boo"] }],
+    ["foo=%20;foo=%2F", { foo: [" ", "/"] }],
+    ["foo=a", { foo: "a" }],
+    ["", {}],
+    ["__proto__=a;__proto__=b", { ["__proto__"]: ["a", "b"] }],
+  ])("should preserve values from %s", (header, expected) => {
+    expect(parse(header, { allowMultiple: true })).toEqual(expected);
+  });
+
+  it("should support custom decoders and filters", () => {
+    expect(
+      parse("foo=a;bar=b;foo=c;bar=d", {
+        allowMultiple: true,
+        decode: (value) => value.toUpperCase(),
+        filter: (key) => key === "foo",
+      }),
+    ).toEqual({ foo: ["A", "C"] });
+    expect(parse("foo=a;foo=b", { allowMultiple: true, decode: () => undefined })).toEqual({
+      foo: [undefined, undefined],
+    });
+  });
+
+  it("should keep the first value when disabled", () => {
+    expect(parse("foo=;foo=b", { allowMultiple: false })).toEqual({ foo: "" });
+  });
+
+  it("should infer return types from the option", () => {
+    expectTypeOf(parse("foo=a").foo).toEqualTypeOf<string | undefined>();
+    expectTypeOf(parse("foo=a", { allowMultiple: false }).foo).toEqualTypeOf<string | undefined>();
+    expectTypeOf(parse("foo=a", { allowMultiple: true }).foo).toEqualTypeOf<
+      string | undefined | (string | undefined)[]
+    >();
+    const options: import("../src").CookieParseOptions = {};
+    expectTypeOf(parse("foo=a", options).foo).toEqualTypeOf<
+      string | undefined | (string | undefined)[]
+    >();
+  });
+});
```

</details>

<details><summary>reply</summary>

`allowMultiple` will preserve duplicate values in order, keep single values as strings, and retain default first-value behavior.


Done.
Added typed `allowMultiple`, docs, tests. Default behavior preserved. 107 tests passed; build passed. Lint/type checks blocked by existing formatting/config/test errors.

</details>

### codex, sloth: pass

Files: [README.md](../sloth/codex/ts-feat-cookie-es-allow-multiple-1/files/README.md), [src/cookie/parse.ts](../sloth/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../sloth/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 0644a07..6c85620 100644
--- a/README.md
+++ b/README.md
@@ -35,6 +35,14 @@ import { parse, serialize, parseSetCookie, splitSetCookieString } from "cookie-e
 import { parse, serialize, parseSetCookie, splitSetCookieString } from "https://esm.sh/cookie-es";
 ```
 
+Pass `allowMultiple: true` to collect duplicate cookie values in order. Names that
+appear once remain strings. By default, the first value wins.
+
+```js
+parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true });
+// { foo: ["a", "b", "c"], bar: "bar" }
+```
+
 ## License
 
 [MIT](./LICENSE)
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..28475c7 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -22,8 +22,22 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse the given cookie header string into an object
  * The object has the various cookies as keys(names) => values
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse(
+  str: string,
+  options?: CookieParseOptions & { allowMultiple?: false },
+): Cookies;
+/**
+ * Parse a `Cookie` header, optionally collecting duplicate values in arrays.
+ */
+export function parse(str: string, options?: CookieParseOptions): Cookies<true>;
+/**
+ * Parse a `Cookie` header using the given decoding and duplicate handling options.
+ */
+export function parse(
+  str: string,
+  options?: CookieParseOptions,
+): Record<string, string | undefined | (string | undefined)[]> {
+  const obj: Cookies<true> = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,8 +64,15 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
+    if (options?.allowMultiple && Object.hasOwn(obj, key)) {
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx));
+      const previous = obj[key];
+      if (Array.isArray(previous)) {
+        previous.push(value);
+      } else {
+        obj[key] = [previous, value];
+      }
+    } else if (obj[key] === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
     }
 
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..78dc52f 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -6,6 +6,13 @@
  * Parse options.
  */
 export interface CookieParseOptions {
+  /**
+   * Collect duplicate cookie values in order. Single values remain strings.
+   *
+   * @default false
+   */
+  allowMultiple?: boolean;
+
   /**
    * Specifies a function that will be used to decode a [cookie-value](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1.1).
    * Since the value of a cookie has a limited character set (and must be a simple string), this function can be used to decode
@@ -28,7 +35,10 @@ export interface CookieParseOptions {
 /**
  * Cookies object.
  */
-export type Cookies = Record<string, string | undefined>;
+export type Cookies<AllowMultiple extends boolean = false> = Record<
+  string,
+  string | undefined | (AllowMultiple extends true ? (string | undefined)[] : never)
+>;
 
 /**
  * Stringify options.
```

</details>

<details><summary>reply</summary>

I’ll check the parser, types, and callers, then add the option and run the existing build and tests.

The change reaches the parser, its public options and return type, and a README example. Existing callers can keep their current string return type; callers enabling the option will get a type that includes arrays. No export, fixture, or config changes are needed.

I’ll preserve decoding and filtering, including custom decoders that return `undefined`. I won’t add new tests, per the repository instructions, but will run the existing suite.

The build and all 97 existing tests pass. The full formatting check found an issue in an untouched test file, and TypeScript stopped on an existing config deprecation. I’ll finish checking the requested examples and rerun TypeScript with that deprecation suppressed.

Implemented `allowMultiple` with ordered duplicate arrays, unchanged decoding, and string values for single occurrences. Default first-value-wins behavior remains unchanged. TypeScript return types and README usage are updated.

Build, lint, all 97 existing tests, and requested examples pass. Full formatting and type checks still encounter pre-existing issues in unrelated test files.

</details>

### codex, all: pass

Files: [src/cookie/parse.ts](../all/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../all/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..eded59a 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -22,8 +22,19 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse the given cookie header string into an object
  * The object has the various cookies as keys(names) => values
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse(
+  str: string,
+  options?: CookieParseOptions & { allowMultiple?: false },
+): Cookies;
+/**
+ * Parse a `Cookie` header, optionally collecting duplicate values in arrays.
+ */
+export function parse(str: string, options: CookieParseOptions): Cookies<true>;
+/**
+ * Parse a `Cookie` header using the supplied options.
+ */
+export function parse(str: string, options?: CookieParseOptions): Cookies<boolean> {
+  const obj: Cookies<true> = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,8 +61,15 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
+    if (options?.allowMultiple && Object.hasOwn(obj, key)) {
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx));
+      const previous = obj[key];
+      if (Array.isArray(previous)) {
+        previous.push(value);
+      } else {
+        obj[key] = [previous, value];
+      }
+    } else if (obj[key] === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
     }
 
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..db84d80 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -6,6 +6,14 @@
  * Parse options.
  */
 export interface CookieParseOptions {
+  /**
+   * Collect duplicate cookie values in arrays, preserving their order.
+   * Cookies that appear only once remain single values.
+   *
+   * @default false
+   */
+  allowMultiple?: boolean;
+
   /**
    * Specifies a function that will be used to decode a [cookie-value](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1.1).
    * Since the value of a cookie has a limited character set (and must be a simple string), this function can be used to decode
@@ -28,7 +36,10 @@ export interface CookieParseOptions {
 /**
  * Cookies object.
  */
-export type Cookies = Record<string, string | undefined>;
+export type Cookies<AllowMultiple extends boolean = false> = Record<
+  string,
+  string | undefined | (AllowMultiple extends true ? (string | undefined)[] : never)
+>;
 
 /**
  * Stringify options.
```

</details>

<details><summary>reply</summary>

Done.
`allowMultiple` preserves duplicates with array-aware types. Defaults unchanged. Build, 97 tests, edge checks passed. Existing formatting/type errors remain elsewhere.

</details>
