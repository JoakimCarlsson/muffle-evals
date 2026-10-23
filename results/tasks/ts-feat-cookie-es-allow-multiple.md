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
| claude | muffle | pass | +39/-5 | 21 | 2,486 | $0.079 |
| claude | hush | pass | +29/-5 | 13 | 1,985 | $0.097 |
| claude | sloth | pass | +30/-6 | 13 | 2,778 | $0.100 |
| claude | all | pass | +31/-6 | 21 | 2,767 | $0.117 |
| codex | base | pass | +36/-5 | 47 | 2,020 | - |
| codex | muffle | pass | +41/-5 | 56 | 2,522 | - |
| codex | hush | pass | +35/-5 | 48 | 2,188 | - |
| codex | sloth | pass | +36/-5 | 36 | 2,167 | - |
| codex | all | pass | +30/-3 | 33 | 2,218 | - |

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
index c80c0f9..f418213 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -3,7 +3,13 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: v1.1.1 (e264dfa)
 
-import type { CookieParseOptions, Cookies, SetCookie } from "./types.ts";
+import type {
+  CookieParseMultipleOptions,
+  CookieParseOptions,
+  Cookies,
+  MultiCookies,
+  SetCookie,
+} from "./types.ts";
 
 /**
  * RegExp to match max-age-value in RFC 6265 sec 5.6.2
@@ -22,8 +28,10 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse the given cookie header string into an object
  * The object has the various cookies as keys(names) => values
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse(str: string, options: CookieParseMultipleOptions): MultiCookies;
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
index 51b39f5..222bb53 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -19,6 +19,14 @@ export interface CookieParseOptions {
    */
   decode?: (str: string) => string | undefined;
 
+  /**
+   * When a cookie name appears more than once, collect all of its values (in order) into an array
+   * instead of keeping only the first. Names that appear once stay plain strings.
+   *
+   * @default false
+   */
+  allowMultiple?: boolean;
+
   /**
    * Custom function to filter parsing specific keys.
    */
@@ -30,6 +38,18 @@ export interface CookieParseOptions {
  */
 export type Cookies = Record<string, string | undefined>;
 
+/**
+ * Cookies object where a name that appears more than once maps to an array of its values.
+ */
+export type MultiCookies = Record<string, string | string[] | undefined>;
+
+/**
+ * Parse options with `allowMultiple` enabled.
+ */
+export interface CookieParseMultipleOptions extends CookieParseOptions {
+  allowMultiple: true;
+}
+
 /**
  * Stringify options.
  */
diff --git a/src/index.ts b/src/index.ts
index bbb51ce..26c659a 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -2,10 +2,12 @@
 export { parse, parseSetCookie } from "./cookie/parse.ts";
 export { serialize, stringifyCookie } from "./cookie/serialize.ts";
 export type {
+  CookieParseMultipleOptions,
   CookieParseOptions,
   CookieSerializeOptions,
   CookieStringifyOptions,
   Cookies,
+  MultiCookies,
   SetCookie,
 } from "./cookie/types.ts";
 
diff --git a/test/cookie-parse.test.ts b/test/cookie-parse.test.ts
index 30228ee..c45285e 100644
--- a/test/cookie-parse.test.ts
+++ b/test/cookie-parse.test.ts
@@ -58,6 +58,27 @@ describe("cookie.parse(str)", () => {
 });
 
 describe("cookie.parse(str, options)", () => {
+  describe('with "allowMultiple" option', () => {
+    it("should collect duplicate names into arrays in order", () => {
+      expect(parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true })).toEqual({
+        foo: ["a", "b", "c"],
+        bar: "bar",
+      });
+      expect(parse("foo=;bar=bar;foo=boo", { allowMultiple: true })).toEqual({
+        foo: ["", "boo"],
+        bar: "bar",
+      });
+    });
+
+    it("should decode values", () => {
+      expect(parse("foo=%1;foo=boo", { allowMultiple: true })).toEqual({ foo: ["%1", "boo"] });
+    });
+
+    it("should keep first value by default", () => {
+      expect(parse("foo=a;foo=b")).toEqual({ foo: "a" });
+    });
+  });
+
   describe('with "decode" option', () => {
     it("should specify alternative value decoder", () => {
       expect(
```

</details>

<details><summary>reply</summary>

`parse()` now takes `allowMultiple`. With it on, a name that appears more than once maps to an array of its decoded values in order, and names that appear once stay plain strings. Both of your examples and the `foo=%1;foo=boo` case give the results you listed. I added tests for these, and all 100 tests pass.

Without the option, the first value still wins. `tsc --noEmit` reports one error, a deprecation warning about `esModuleInterop` in `tsconfig.json`. I didn't touch that file, and I haven't confirmed whether the error predates my change.

For the return type, `parse()` has an overload. Passing `{ allowMultiple: true }` returns the new `MultiCookies` type (`Record<string, string | string[] | undefined>`). Any other call still returns `Cookies`. I exported the new `MultiCookies` and `CookieParseMultipleOptions` types from `src/index.ts`.

`allowMultiple` is also accepted by `parseSetCookie()` because it shares the options type, but it has no effect there. I didn't update the README, since it doesn't mention the existing options for `parse()`.

The code changes are in `src/cookie/parse.ts` and `src/cookie/types.ts`, and the tests are in `test/cookie-parse.test.ts`. I haven't committed anything.

</details>

### claude, hush: pass

Files: [src/cookie/parse.ts](../hush/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../hush/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [src/index.ts](../hush/claude/ts-feat-cookie-es-allow-multiple-1/files/src/index.ts), [test/cookie-parse.test.ts](../hush/claude/ts-feat-cookie-es-allow-multiple-1/files/test/cookie-parse.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..a241601 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -3,7 +3,7 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: v1.1.1 (e264dfa)
 
-import type { CookieParseOptions, Cookies, SetCookie } from "./types.ts";
+import type { CookieParseOptions, Cookies, CookiesMultiple, SetCookie } from "./types.ts";
 
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
+): CookiesMultiple;
+export function parse(str: string, options?: CookieParseOptions): Cookies;
+export function parse(str: string, options?: CookieParseOptions): Cookies | CookiesMultiple {
+  const obj: CookiesMultiple = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,9 +55,14 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
+    const existing = obj[key];
+    if (existing === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
+    } else if (options?.allowMultiple) {
+      // keep every value in order
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx)) as string;
+      if (Array.isArray(existing)) existing.push(value);
+      else obj[key] = [existing, value];
     }
 
     index = endIdx + 1;
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..bc73645 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -23,6 +23,14 @@ export interface CookieParseOptions {
    * Custom function to filter parsing specific keys.
    */
   filter?(key: string): boolean;
+
+  /**
+   * Keep every value of a cookie name that appears more than once, instead of only the first.
+   * Repeated names map to an array of values in order; names that appear once stay plain strings.
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
+ * Cookies object where repeated names map to an array of values.
+ */
+export type CookiesMultiple = Record<string, string | string[] | undefined>;
+
 /**
  * Stringify options.
  */
diff --git a/src/index.ts b/src/index.ts
index bbb51ce..e5029e1 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -6,6 +6,7 @@ export type {
   CookieSerializeOptions,
   CookieStringifyOptions,
   Cookies,
+  CookiesMultiple,
   SetCookie,
 } from "./cookie/types.ts";
 
diff --git a/test/cookie-parse.test.ts b/test/cookie-parse.test.ts
index 30228ee..4ca178e 100644
--- a/test/cookie-parse.test.ts
+++ b/test/cookie-parse.test.ts
@@ -78,5 +78,18 @@ describe("cookie.parse(str, options)", () => {
 
       expect(parse("a=1;b=2")).toEqual({ a: "1", b: "2" });
     });
+
+    it("parse allowMultiple", () => {
+      expect(parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true })).toEqual({
+        foo: ["a", "b", "c"],
+        bar: "bar",
+      });
+      expect(parse("foo=;bar=bar;foo=boo", { allowMultiple: true })).toEqual({
+        foo: ["", "boo"],
+        bar: "bar",
+      });
+      expect(parse("foo=%1;foo=boo", { allowMultiple: true })).toEqual({ foo: ["%1", "boo"] });
+      expect(parse("foo=a;foo=b")).toEqual({ foo: "a" });
+    });
   });
 });
```

</details>

<details><summary>reply</summary>

Done. `parse()` now takes `allowMultiple`, with a `CookiesMultiple` return type via overload. Tests pass (98). `tsc` only reports an existing tsconfig deprecation error, which I left alone. Nothing committed.

</details>

### claude, sloth: pass

Files: [src/cookie/parse.ts](../sloth/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../sloth/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [src/index.ts](../sloth/claude/ts-feat-cookie-es-allow-multiple-1/files/src/index.ts), [test/cookie-parse.test.ts](../sloth/claude/ts-feat-cookie-es-allow-multiple-1/files/test/cookie-parse.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..0cc7e99 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -3,7 +3,7 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: v1.1.1 (e264dfa)
 
-import type { CookieParseOptions, Cookies, SetCookie } from "./types.ts";
+import type { CookieParseOptions, Cookies, CookiesMultiple, SetCookie } from "./types.ts";
 
 /**
  * RegExp to match max-age-value in RFC 6265 sec 5.6.2
@@ -20,10 +20,16 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse a `Cookie` header.
  *
  * Parse the given cookie header string into an object
- * The object has the various cookies as keys(names) => values
+ * The object has the various cookies as keys(names) => values.
+ * With `allowMultiple`, a repeated name maps to an array of all its values.
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse(
+  str: string,
+  options: CookieParseOptions & { allowMultiple: true },
+): CookiesMultiple;
+export function parse(str: string, options?: CookieParseOptions): Cookies;
+export function parse(str: string, options?: CookieParseOptions): CookiesMultiple {
+  const obj: CookiesMultiple = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,9 +56,13 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
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
index 51b39f5..078d6c8 100644
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
+ * Cookies object where a repeated name maps to an array of values.
+ */
+export type CookiesMultiple = Record<string, string | string[] | undefined>;
+
 /**
  * Stringify options.
  */
diff --git a/src/index.ts b/src/index.ts
index bbb51ce..e5029e1 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -6,6 +6,7 @@ export type {
   CookieSerializeOptions,
   CookieStringifyOptions,
   Cookies,
+  CookiesMultiple,
   SetCookie,
 } from "./cookie/types.ts";
 
diff --git a/test/cookie-parse.test.ts b/test/cookie-parse.test.ts
index 30228ee..26ec21d 100644
--- a/test/cookie-parse.test.ts
+++ b/test/cookie-parse.test.ts
@@ -78,5 +78,18 @@ describe("cookie.parse(str, options)", () => {
 
       expect(parse("a=1;b=2")).toEqual({ a: "1", b: "2" });
     });
+
+    it("parse multiple values with allowMultiple", () => {
+      expect(parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true })).toEqual({
+        foo: ["a", "b", "c"],
+        bar: "bar",
+      });
+      expect(parse("foo=;bar=bar;foo=boo", { allowMultiple: true })).toEqual({
+        foo: ["", "boo"],
+        bar: "bar",
+      });
+      expect(parse("foo=%1;foo=boo", { allowMultiple: true })).toEqual({ foo: ["%1", "boo"] });
+      expect(parse("foo=a;foo=b")).toEqual({ foo: "a" });
+    });
   });
 });
```

</details>

<details><summary>reply</summary>

Export the new type too (the tsc error is a pre-existing config deprecation).

`parse()` now takes `allowMultiple: true`, and a repeated name maps to an array of all its values in order. The tests pass, including a new one for your examples. The type-check only reports an existing `esModuleInterop` deprecation error in `tsconfig.json`, so I haven't type-checked the new overloads with `tsc`.

- **Behaviour:** Names that appear once stay plain strings. Values are decoded exactly as before, so `foo=%1;foo=boo` gives `["%1", "boo"]`. Without the option, the first value still wins.
- **Types:** `parse` has an overload, so passing `allowMultiple: true` returns the new `CookiesMultiple` type (values can be `string | string[]`). Calls without it keep returning `Cookies`, so existing callers' types don't change. `CookiesMultiple` is exported from the package.
- **Files changed:** `src/cookie/parse.ts`, `src/cookie/types.ts` and `src/index.ts`, plus the test in `test/cookie-parse.test.ts`.

I didn't commit anything.

</details>

### claude, all: pass

Files: [src/cookie/parse.ts](../all/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../all/claude/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [src/index.ts](../all/claude/ts-feat-cookie-es-allow-multiple-1/files/src/index.ts), [test/cookie-parse.test.ts](../all/claude/ts-feat-cookie-es-allow-multiple-1/files/test/cookie-parse.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..d76c7b7 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -3,7 +3,7 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: v1.1.1 (e264dfa)
 
-import type { CookieParseOptions, Cookies, SetCookie } from "./types.ts";
+import type { CookieParseOptions, Cookies, MultiCookies, SetCookie } from "./types.ts";
 
 /**
  * RegExp to match max-age-value in RFC 6265 sec 5.6.2
@@ -21,9 +21,16 @@ const NullObject = /* @__PURE__ */ (() => {
  *
  * Parse the given cookie header string into an object
  * The object has the various cookies as keys(names) => values
+ *
+ * With `allowMultiple`, a name that appears more than once maps to an array of all its values.
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
index 51b39f5..3209dd3 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -23,6 +23,14 @@ export interface CookieParseOptions {
    * Custom function to filter parsing specific keys.
    */
   filter?(key: string): boolean;
+
+  /**
+   * Collect repeated cookie names into an array of all their values, in order.
+   * Names that appear once stay plain strings. By default the first value wins.
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
 
diff --git a/test/cookie-parse.test.ts b/test/cookie-parse.test.ts
index 30228ee..af19905 100644
--- a/test/cookie-parse.test.ts
+++ b/test/cookie-parse.test.ts
@@ -6,6 +6,27 @@
 import { describe, it, expect } from "vitest";
 import { parse } from "../src";
 
+describe("cookie.parse(str, { allowMultiple })", () => {
+  it("should collect repeated names in order", () => {
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
+
 describe("cookie.parse(str)", () => {
   it("should return empty object for empty string", () => {
     expect(parse("")).toMatchObject({});
```

</details>

<details><summary>reply</summary>

Exporting new `MultiCookies` type; then rechecking types and tests.

Done. `parse()` now takes `allowMultiple`; repeated names become arrays in order, single names stay strings, and the default is still first value wins. I added `MultiCookies` as the return type for `allowMultiple: true` (via an overload) and exported it.

The 100 tests pass, including new ones for your two examples, `%1` decoding and the default. `tsc` reports 5 errors, all in `test/split-cookies-string.test.ts` and identical with my changes stashed. It also needs `--ignoreDeprecations 6.0` to run at all.

One edge case: a duplicate whose custom `decode` returns `undefined` is skipped rather than added to the array.

I didn't touch the README, since it doesn't document `parse` options.

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
index 0644a07..b8d7db2 100644
--- a/README.md
+++ b/README.md
@@ -35,6 +35,15 @@ import { parse, serialize, parseSetCookie, splitSetCookieString } from "cookie-e
 import { parse, serialize, parseSetCookie, splitSetCookieString } from "https://esm.sh/cookie-es";
 ```
 
+By default, `parse()` keeps the first value when a cookie name appears more than once.
+Set `allowMultiple: true` to collect repeated values in header order. Names that
+appear once remain strings, and all values use the configured decoder.
+
+```js
+parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true });
+// => { foo: ["a", "b", "c"], bar: "bar" }
+```
+
 ## License
 
 [MIT](./LICENSE)
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..0c9a339 100644
--- a/src/cookie/parse.ts
+++ b/src/cookie/parse.ts
@@ -22,8 +22,17 @@ const NullObject = /* @__PURE__ */ (() => {
  * Parse the given cookie header string into an object
  * The object has the various cookies as keys(names) => values
  */
-export function parse(str: string, options?: CookieParseOptions): Cookies {
-  const obj: Cookies = new NullObject();
+export function parse(
+  str: string,
+  options: CookieParseOptions & { allowMultiple: true },
+): Cookies<true>;
+export function parse(
+  str: string,
+  options?: CookieParseOptions & { allowMultiple?: false },
+): Cookies;
+export function parse(str: string, options?: CookieParseOptions): Cookies<boolean>;
+export function parse(str: string, options?: CookieParseOptions): Cookies<boolean> {
+  const obj: Cookies<boolean> = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,8 +59,15 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
+    if (options?.allowMultiple && Object.hasOwn(obj, key)) {
+      const previous = obj[key];
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx));
+      if (Array.isArray(previous)) {
+        previous.push(value);
+      } else {
+        obj[key] = [previous, value];
+      }
+    } else if (obj[key] === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
     }
 
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..16eb5f4 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -6,6 +6,14 @@
  * Parse options.
  */
 export interface CookieParseOptions {
+  /**
+   * Collect duplicate cookie values in an array, in header order.
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
+  string | undefined | (AllowMultiple extends true ? (string | undefined)[] : never)
+>;
 
 /**
  * Stringify options.
diff --git a/test/cookie-parse.test.ts b/test/cookie-parse.test.ts
index 30228ee..0294130 100644
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
@@ -58,6 +59,60 @@ describe("cookie.parse(str)", () => {
 });
 
 describe("cookie.parse(str, options)", () => {
+  describe('with "allowMultiple" option', () => {
+    it("should collect duplicate values in order and keep single values as strings", () => {
+      expect(parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true })).toEqual({
+        foo: ["a", "b", "c"],
+        bar: "bar",
+      });
+      expect(parse("foo=;bar=bar;foo=boo", { allowMultiple: true })).toEqual({
+        foo: ["", "boo"],
+        bar: "bar",
+      });
+      expect(parse("", { allowMultiple: true })).toEqual({});
+    });
+
+    it("should decode every value and preserve malformed escapes", () => {
+      expect(parse("foo=%1;foo=boo;foo=%20", { allowMultiple: true })).toEqual({
+        foo: ["%1", "boo", " "],
+      });
+      expect(
+        parse("foo=a;foo=b;foo=c;bar=d", {
+          allowMultiple: true,
+          decode: (value) => value.toUpperCase(),
+          filter: (key) => key === "foo",
+        }),
+      ).toEqual({ foo: ["A", "B", "C"] });
+    });
+
+    it("should preserve undefined values returned by a custom decoder", () => {
+      expect(
+        parse("foo=a;foo=b;foo=c", {
+          allowMultiple: true,
+          decode: () => undefined,
+        }),
+      ).toEqual({ foo: [undefined, undefined, undefined] });
+    });
+
+    it("should handle cookie names inherited by ordinary objects", () => {
+      expect(
+        parse("__proto__=a;__proto__=b;constructor=c;constructor=d", { allowMultiple: true }),
+      ).toEqual({ ["__proto__"]: ["a", "b"], constructor: ["c", "d"] });
+    });
+
+    it("should keep the first value when disabled", () => {
+      expect(parse("foo=;foo=b;foo=c", { allowMultiple: false })).toEqual({ foo: "" });
+    });
+
+    it("should infer the return type from the option", () => {
+      expectTypeOf(parse("foo=a")).toEqualTypeOf<Cookies>();
+      expectTypeOf(parse("foo=a", { allowMultiple: false })).toEqualTypeOf<Cookies>();
+      expectTypeOf(parse("foo=a", { allowMultiple: true })).toEqualTypeOf<Cookies<true>>();
+      const options: CookieParseOptions = {};
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

I’ll check the parser, types, and tests, then add `allowMultiple` while preserving the default first-value behavior.

The option is implemented, and all 103 tests pass, including duplicate ordering, empty values, decoding, and filtering. The type check hit an existing TypeScript 6 configuration deprecation; I’ll suppress that diagnostic for verification, then finish the build check.

Added `allowMultiple` with inferred return types and documentation.

- Duplicate values become arrays in header order; single values stay strings.
- Empty values and decoding behavior are preserved.
- Default behavior remains first value wins.

All 103 tests and the build pass. Full type checking remains blocked by existing configuration and unrelated test errors.

</details>

### codex, hush: pass

Files: [README.md](../hush/codex/ts-feat-cookie-es-allow-multiple-1/files/README.md), [src/cookie/parse.ts](../hush/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../hush/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [test/cookie-parse.test.ts](../hush/codex/ts-feat-cookie-es-allow-multiple-1/files/test/cookie-parse.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 0644a07..bb3f8bb 100644
--- a/README.md
+++ b/README.md
@@ -35,6 +35,13 @@ import { parse, serialize, parseSetCookie, splitSetCookieString } from "cookie-e
 import { parse, serialize, parseSetCookie, splitSetCookieString } from "https://esm.sh/cookie-es";
 ```
 
+To collect duplicate cookie values in order, enable `allowMultiple`. Names that appear once remain strings. By default, the first value wins.
+
+```js
+parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true });
+// { foo: ["a", "b", "c"], bar: "bar" }
+```
+
 ## License
 
 [MIT](./LICENSE)
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..7afdc98 100644
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
@@ -50,9 +54,18 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
+    const previous = obj[key];
+    if (previous === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
+    } else if (options?.allowMultiple) {
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx));
+      if (value !== undefined) {
+        if (Array.isArray(previous)) {
+          previous.push(value);
+        } else {
+          obj[key] = [previous, value];
+        }
+      }
     }
 
     index = endIdx + 1;
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..4c646b6 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -6,6 +6,13 @@
  * Parse options.
  */
 export interface CookieParseOptions {
+  /**
+   * Collect duplicate cookie values in an array, preserving their order.
+   * Names that appear once keep a single string value.
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
+  string | undefined | (AllowMultiple extends true ? string[] : never)
+>;
 
 /**
  * Stringify options.
diff --git a/test/cookie-parse.test.ts b/test/cookie-parse.test.ts
index 30228ee..01ffba2 100644
--- a/test/cookie-parse.test.ts
+++ b/test/cookie-parse.test.ts
@@ -3,7 +3,7 @@
 // Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 // Last sync: e264dfa
 
-import { describe, it, expect } from "vitest";
+import { describe, it, expect, expectTypeOf } from "vitest";
 import { parse } from "../src";
 
 describe("cookie.parse(str)", () => {
@@ -80,3 +80,50 @@ describe("cookie.parse(str, options)", () => {
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
+    ["foo=a;foo=a", { foo: ["a", "a"] }],
+    ["__proto__=a;__proto__=b", { ["__proto__"]: ["a", "b"] }],
+    ["", {}],
+  ])("collects values from %s", (header, expected) => {
+    expect(parse(header, { allowMultiple: true })).toEqual(expected);
+  });
+
+  it("keeps the first value when disabled", () => {
+    expect(parse("foo=;foo=b", { allowMultiple: false })).toEqual({ foo: "" });
+  });
+
+  it("supports custom decoding and filtering", () => {
+    expect(
+      parse("foo=a;bar=x;foo=b;bar=y", {
+        allowMultiple: true,
+        decode: (value) => value.toUpperCase(),
+        filter: (key) => key === "foo",
+      }),
+    ).toEqual({ foo: ["A", "B"] });
+  });
+
+  it("preserves undefined decoder behavior", () => {
+    expect(
+      parse("foo=skip;foo=a;foo=skip;foo=b", {
+        allowMultiple: true,
+        decode: (value) => (value === "skip" ? undefined : value),
+      }),
+    ).toEqual({ foo: ["a", "b"] });
+  });
+
+  it("infers return types from options", () => {
+    expectTypeOf(parse("").foo).toEqualTypeOf<string | undefined>();
+    expectTypeOf(parse("", { allowMultiple: false }).foo).toEqualTypeOf<string | undefined>();
+    expectTypeOf(parse("", { allowMultiple: true }).foo).toEqualTypeOf<
+      string | string[] | undefined
+    >();
+    const options: import("../src").CookieParseOptions = {};
+    expectTypeOf(parse("", options).foo).toEqualTypeOf<string | string[] | undefined>();
+  });
+});
```

</details>

<details><summary>reply</summary>

Done.
Added typed `allowMultiple`, ordered arrays, docs, tests; defaults unchanged. 108 tests pass. Existing formatting and TypeScript errors block full checks.

</details>

### codex, sloth: pass

Files: [README.md](../sloth/codex/ts-feat-cookie-es-allow-multiple-1/files/README.md), [src/cookie/parse.ts](../sloth/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../sloth/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [test/cookie-parse.test.ts](../sloth/codex/ts-feat-cookie-es-allow-multiple-1/files/test/cookie-parse.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 0644a07..92c177d 100644
--- a/README.md
+++ b/README.md
@@ -35,6 +35,14 @@ import { parse, serialize, parseSetCookie, splitSetCookieString } from "cookie-e
 import { parse, serialize, parseSetCookie, splitSetCookieString } from "https://esm.sh/cookie-es";
 ```
 
+Pass `allowMultiple: true` to preserve duplicate cookie values in order. Names that
+appear once stay strings. By default, only the first value is kept.
+
+```ts
+parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true });
+// => { foo: ["a", "b", "c"], bar: "bar" }
+```
+
 ## License
 
 [MIT](./LICENSE)
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..8d54651 100644
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
@@ -50,8 +54,17 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
-    if (obj[key] === undefined) {
+    if (options?.allowMultiple) {
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx));
+      const previous = obj[key];
+      if (Array.isArray(previous)) {
+        previous.push(value);
+      } else if (Object.hasOwn(obj, key)) {
+        obj[key] = [previous, value];
+      } else {
+        obj[key] = value;
+      }
+    } else if (obj[key] === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
     }
 
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..9eab53d 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -6,6 +6,13 @@
  * Parse options.
  */
 export interface CookieParseOptions {
+  /**
+   * Preserve duplicate cookie values as arrays in encounter order.
+   * Names appearing once remain strings.
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
index 30228ee..8a90b65 100644
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
@@ -58,6 +59,40 @@ describe("cookie.parse(str)", () => {
 });
 
 describe("cookie.parse(str, options)", () => {
+  it("should preserve duplicate values only when allowMultiple is enabled", () => {
+    const cookies = parse("foo=a;bar=bar;foo=b;foo=c", { allowMultiple: true });
+    expect(cookies).toEqual({ foo: ["a", "b", "c"], bar: "bar" });
+    expect(parse("foo=;bar=bar;foo=boo", { allowMultiple: true })).toEqual({
+      foo: ["", "boo"],
+      bar: "bar",
+    });
+    expect(parse("foo=%1;foo=boo;foo=%20", { allowMultiple: true })).toEqual({
+      foo: ["%1", "boo", " "],
+    });
+    expect(parse("", { allowMultiple: true })).toEqual({});
+    expect(
+      parse("foo=a;bar=bar;foo=b", {
+        allowMultiple: true,
+        decode: (value) => value.toUpperCase(),
+        filter: (key) => key === "foo",
+      }),
+    ).toEqual({ foo: ["A", "B"] });
+    expect(parse("foo=a;foo=b;foo=c", { allowMultiple: true, decode: () => undefined })).toEqual({
+      foo: [undefined, undefined, undefined],
+    });
+    expect(parse("__proto__=a;__proto__=b", { allowMultiple: true })["__proto__"]).toEqual([
+      "a",
+      "b",
+    ]);
+    expect(parse("foo=a;foo=b", { allowMultiple: false })).toEqual({ foo: "a" });
+
+    expectTypeOf(cookies).toEqualTypeOf<Cookies<true>>();
+    expectTypeOf(parse("foo=a")).toEqualTypeOf<Cookies>();
+    expectTypeOf(parse("foo=a", { allowMultiple: false })).toEqualTypeOf<Cookies>();
+    const options: CookieParseOptions = { allowMultiple: true };
+    expectTypeOf(parse("foo=a", options)).toEqualTypeOf<Cookies<boolean>>();
+  });
+
   describe('with "decode" option', () => {
     it("should specify alternative value decoder", () => {
       expect(
```

</details>

<details><summary>reply</summary>

I’ll check the parser, its callers, types, and tests, then add the option while preserving first-value-wins behavior by default.

The change reaches the parser, the exported options and result types, the existing parser tests, and a README example. There are no internal callers to update or fixtures/config changes needed. I’ll keep default return types unchanged and include `undefined` in array element types because custom decoders already support returning it. No additional parsing options are needed.

The option is implemented, and all 98 tests pass. The build and lint also pass. Since `pnpm` isn’t installed, I ran the installed tools directly. Validation found an existing TypeScript config deprecation and a formatting issue in the untouched serializer test; I’m checking types with the deprecation suppressed.

Added `allowMultiple: true` with ordered duplicate arrays, unchanged decoding, and option-aware return types. Default behavior remains unchanged. Added tests and README documentation.

Validation: all 98 tests, build, and lint pass. Full type and formatting checks encounter existing issues in unrelated tests/config.

</details>

### codex, all: pass

Files: [src/cookie/parse.ts](../all/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/parse.ts), [src/cookie/types.ts](../all/codex/ts-feat-cookie-es-allow-multiple-1/files/src/cookie/types.ts), [test/cookie-parse.test.ts](../all/codex/ts-feat-cookie-es-allow-multiple-1/files/test/cookie-parse.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/cookie/parse.ts b/src/cookie/parse.ts
index c80c0f9..357f2b4 100644
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
+export function parse(
+  str: string,
+  options?: CookieParseOptions,
+): Record<string, string | string[] | undefined>;
+export function parse(
+  str: string,
+  options?: CookieParseOptions,
+): Record<string, string | string[] | undefined> {
+  const obj: Record<string, string | string[] | undefined> = new NullObject();
   const len = str.length;
   // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
   if (len < 2) return obj;
@@ -50,9 +61,18 @@ export function parse(str: string, options?: CookieParseOptions): Cookies {
       continue;
     }
 
-    // only assign once
     if (obj[key] === undefined) {
       obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
+    } else if (options?.allowMultiple) {
+      const value = dec(valueSlice(str, eqIdx + 1, endIdx));
+      if (value !== undefined) {
+        const previous = obj[key];
+        if (Array.isArray(previous)) {
+          previous.push(value);
+        } else {
+          obj[key] = [previous, value];
+        }
+      }
     }
 
     index = endIdx + 1;
diff --git a/src/cookie/types.ts b/src/cookie/types.ts
index 51b39f5..b4fc2ec 100644
--- a/src/cookie/types.ts
+++ b/src/cookie/types.ts
@@ -6,6 +6,13 @@
  * Parse options.
  */
 export interface CookieParseOptions {
+  /**
+   * Collect duplicate cookie values in order, keeping single values as strings.
+   *
+   * @default false
+   */
+  allowMultiple?: boolean;
+
   /**
    * Specifies a function that will be used to decode a [cookie-value](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1.1).
    * Since the value of a cookie has a limited character set (and must be a simple string), this function can be used to decode
diff --git a/test/cookie-parse.test.ts b/test/cookie-parse.test.ts
index 30228ee..12a1758 100644
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
@@ -58,6 +59,37 @@ describe("cookie.parse(str)", () => {
 });
 
 describe("cookie.parse(str, options)", () => {
+  it("should collect duplicate values only when allowMultiple is enabled", () => {
+    const options: CookieParseOptions = { allowMultiple: true };
+    const cookies = parse("foo=a;bar=bar;foo=b;foo=c", options);
+    expect(cookies).toEqual({ foo: ["a", "b", "c"], bar: "bar" });
+    expect(parse("foo=;bar=bar;foo=boo", options)).toEqual({
+      foo: ["", "boo"],
+      bar: "bar",
+    });
+    expect(parse("foo=%1;foo=boo;foo=%20", options)).toEqual({
+      foo: ["%1", "boo", " "],
+    });
+    expect(parse("", options)).toEqual({});
+    expect(parse("foo=a;foo=b", { allowMultiple: false })).toEqual({ foo: "a" });
+    expect(
+      parse("foo=a;bar=b;foo=c", {
+        allowMultiple: true,
+        decode: (value) => value.toUpperCase(),
+        filter: (key) => key === "foo",
+      }),
+    ).toEqual({ foo: ["A", "C"] });
+    expect(parse("__proto__=a;__proto__=b", options)).toEqual({
+      ["__proto__"]: ["a", "b"],
+    });
+    expectTypeOf(cookies).toEqualTypeOf<Record<string, string | string[] | undefined>>();
+    expectTypeOf(parse("foo=a", { allowMultiple: true })).toEqualTypeOf<
+      Record<string, string | string[] | undefined>
+    >();
+    expectTypeOf(parse("foo=a")).toEqualTypeOf<Cookies>();
+    expectTypeOf(parse("foo=a", { allowMultiple: false })).toEqualTypeOf<Cookies>();
+  });
+
   describe('with "decode" option', () => {
     it("should specify alternative value decoder", () => {
       expect(
```

</details>

<details><summary>reply</summary>

`parse()` needs option, duplicate handling, types, tests checked.


Done.
`allowMultiple` added with array types; defaults preserved. 98 tests, build passed. Full lint/typecheck blocked by existing formatting, TypeScript config, unrelated test errors.

</details>
