# ts-ufo-base-prefix

Source: https://github.com/unjs/ufo/pull/313

## Prompt

> `withBase` and `withoutBase` treat a path as being under the base when it only shares a prefix with it.
> 
> I have a Nuxt app with `app: { baseURL: '/admin/' }` and a page at `/admin-dashboard`. `nuxt generate` writes a stray stub file called `-dashboard` into `.output/public`, and I tracked it down to ufo:
> 
> ```js
> withoutBase('/admin-dashboard', '/admin/') // => '/-dashboard', expected '/admin-dashboard'
> withBase('/admin-dashboard', '/admin/')    // => '/admin-dashboard', expected '/admin/admin-dashboard'
> ```
> 
> `/admin-dashboard` is not inside `/admin/`, so `withoutBase` should leave it alone and `withBase` should prefix it. Paths that really are under the base (`/admin`, `/admin/dashboard`, `/admin?x`) should keep working as before.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [src/utils.ts](../../tasks/ts-ufo-base-prefix/upstream/src/utils.ts), [test/base.test.ts](../../tasks/ts-ufo-base-prefix/upstream/test/base.test.ts)

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..19004d9 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -293,7 +293,11 @@ export function withBase(input: string, base: string) {
   }
   const _base = withoutTrailingSlash(base);
   if (input.startsWith(_base)) {
-    return input;
+    const nextChar = input[_base.length];
+    // Ensure '/admin-dashboard' is not considered as having base '/admin/'
+    if (!nextChar || nextChar === "/" || nextChar === "?") {
+      return input;
+    }
   }
   return joinURL(_base, input);
 }
@@ -319,6 +323,11 @@ export function withoutBase(input: string, base: string) {
   if (!input.startsWith(_base)) {
     return input;
   }
+  // Ensure '/admin-dashboard' is not considered as having base '/admin/'
+  const nextChar = input[_base.length];
+  if (nextChar && nextChar !== "/" && nextChar !== "?") {
+    return input;
+  }
   const trimmed = input.slice(_base.length);
   return trimmed[0] === "/" ? trimmed : "/" + trimmed;
 }
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +10/-2 | 17 | 1,708 | $0.080 |
| claude | muffle | pass | +10/-2 | 6 | 2,164 | $0.078 |
| claude | hush | pass | +10/-2 | 0 | 602 | $0.036 |
| claude | sloth | pass | +12/-2 | 0 | 1,943 | $0.073 |
| claude | all | pass | +12/-2 | 0 | 985 | $0.061 |
| codex | base | pass | +10/-2 | 17 | 1,218 | - |
| codex | muffle | pass | +10/-2 | 44 | 991 | - |
| codex | hush | pass | +10/-2 | 22 | 891 | - |
| codex | sloth | pass | +14/-6 | 0 | 1,238 | - |
| codex | all | pass | +8/-2 | 0 | 924 | - |

### claude, base: pass

Files: [src/utils.ts](../base/claude/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../base/claude/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..d3cd8d0 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,12 +292,20 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (_isUnderBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
 }
 
+function _isUnderBase(input: string, base: string) {
+  if (!input.startsWith(base)) {
+    return false;
+  }
+  const next = input[base.length];
+  return !next || next === "/" || next === "?" || next === "#";
+}
+
 /**
  * Removes the base from the URL or pathname.
  *
@@ -316,7 +324,7 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!_isUnderBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..f62433a 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -22,6 +22,19 @@ describe("withBase", () => {
   }
 });
 
+describe("withBase prefix-only match", () => {
+  test("prefixes paths that only share a prefix with base", () => {
+    expect(withBase("/admin-dashboard", "/admin/")).toBe(
+      "/admin/admin-dashboard",
+    );
+  });
+  test("keeps paths under base", () => {
+    expect(withBase("/admin", "/admin/")).toBe("/admin");
+    expect(withBase("/admin/dashboard", "/admin/")).toBe("/admin/dashboard");
+    expect(withBase("/admin?x", "/admin/")).toBe("/admin?x");
+  });
+});
+
 describe("withoutBase", () => {
   const tests = [
     { base: "/", input: "/", out: "/" },
@@ -38,6 +51,10 @@ describe("withoutBase", () => {
     { base: "/api", input: "/api?test", out: "/?test" },
     { base: "/base/", input: "https://test.com", out: "https://test.com" },
     { base: "/", input: "https://test.com", out: "https://test.com" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin/", input: "/admin", out: "/" },
+    { base: "/admin/", input: "/admin/dashboard", out: "/dashboard" },
+    { base: "/admin/", input: "/admin?x", out: "/?x" },
   ];
 
   for (const t of tests) {
```

</details>

<details><summary>reply</summary>

Now add tests.

I fixed both functions in `src/utils.ts`, and the full test suite passes (483 tests), including the new ones I added.

I added a small helper, `_isUnderBase`. It treats an input as under the base only if it starts with the base and the next character is the end of the string, `/`, `?` or `#`. `withBase` and `withoutBase` both use it instead of a plain `startsWith`.

- **`withoutBase('/admin-dashboard', '/admin/')`** now returns `/admin-dashboard`.
- **`withBase('/admin-dashboard', '/admin/')`** now returns `/admin/admin-dashboard`.
- **Paths under the base** such as `/admin`, `/admin/dashboard` and `/admin?x` behave as before.

I added the `/admin-dashboard` and under-base cases to `test/base.test.ts`. I didn't run `nuxt generate` against the fix.

I haven't committed anything.

</details>

### claude, muffle: pass

Files: [src/utils.ts](../muffle/claude/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../muffle/claude/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..ebfb55e 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -272,6 +272,14 @@ export function cleanDoubleSlashes(input = ""): string {
     .join("://");
 }
 
+function _isUnderBase(input: string, base: string) {
+  if (!input.startsWith(base)) {
+    return false;
+  }
+  const next = input[base.length];
+  return next === undefined || next === "/" || next === "?" || next === "#";
+}
+
 /**
  * Ensures the URL or pathname starts with base.
  *
@@ -292,7 +300,7 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (_isUnderBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
@@ -316,7 +324,7 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!_isUnderBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..ac67a09 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -11,6 +11,8 @@ describe("withBase", () => {
     { base: "/base", input: "/base/", out: "/base/" },
     { base: "/base", input: "/base/a", out: "/base/a" },
     { base: "/base/", input: "/base/a", out: "/base/a" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin/admin-dashboard" },
+    { base: "/admin/", input: "/admin/dashboard", out: "/admin/dashboard" },
     { base: "/base/", input: "https://test.com", out: "https://test.com" },
     { base: "/", input: "https://test.com", out: "https://test.com" },
   ];
@@ -36,6 +38,10 @@ describe("withoutBase", () => {
     { base: "/", input: "/test/", out: "/test/" },
     { base: "/", input: "/?test", out: "/?test" },
     { base: "/api", input: "/api?test", out: "/?test" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin/", input: "/admin", out: "/" },
+    { base: "/admin/", input: "/admin/dashboard", out: "/dashboard" },
+    { base: "/admin/", input: "/admin?x", out: "/?x" },
     { base: "/base/", input: "https://test.com", out: "https://test.com" },
     { base: "/", input: "https://test.com", out: "https://test.com" },
   ];
```

</details>

<details><summary>reply</summary>

Now add tests.

I fixed `withBase` and `withoutBase` in `src/utils.ts`. The full test suite and eslint both pass.

A path now counts as under the base only if the character right after the base is `/`, `?` or `#`, or if the path ends exactly at the base. Both functions use one shared helper, `_isUnderBase`, for this check. So:

- `withoutBase('/admin-dashboard', '/admin/')` returns `/admin-dashboard`.
- `withBase('/admin-dashboard', '/admin/')` returns `/admin/admin-dashboard`.
- `/admin`, `/admin/dashboard` and `/admin?x` behave as before.

I added cases for all of these to `test/base.test.ts`. I didn't run `nuxt generate`, so the stray `-dashboard` file in `.output/public` isn't confirmed gone. It should be, since that file came from `withoutBase` returning `/-dashboard`.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [src/utils.ts](../hush/claude/ts-ufo-base-prefix-1/files/src/utils.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..832c069 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,12 +292,20 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (isUnderBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
 }
 
+function isUnderBase(input: string, base: string) {
+  if (!input.startsWith(base)) {
+    return false;
+  }
+  const next = input[base.length];
+  return !next || next === "/" || next === "?" || next === "#";
+}
+
 /**
  * Removes the base from the URL or pathname.
  *
@@ -316,7 +324,7 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!isUnderBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
```

</details>

<details><summary>reply</summary>

Done. Added `isUnderBase` in `src/utils.ts`: the base must be followed by end, `/`, `?` or `#`. `withBase` and `withoutBase` use it. Existing tests pass. I added no new test for `/admin-dashboard`.

</details>

### claude, sloth: pass

Files: [src/utils.ts](../sloth/claude/ts-ufo-base-prefix-1/files/src/utils.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..637bff8 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -272,6 +272,16 @@ export function cleanDoubleSlashes(input = ""): string {
     .join("://");
 }
 
+/**
+ * Checks whether input is the base itself or continues it at a path, query or hash boundary.
+ */
+function isUnderBase(input: string, base: string) {
+  return (
+    input.startsWith(base) &&
+    (input.length === base.length || "/?#".includes(input[base.length]))
+  );
+}
+
 /**
  * Ensures the URL or pathname starts with base.
  *
@@ -292,7 +302,7 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (isUnderBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
@@ -316,7 +326,7 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!isUnderBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
```

</details>

<details><summary>reply</summary>

Prettier was clean before my edit, so I'll format and verify through vitest instead.

`withBase` and `withoutBase` now only treat a path as under the base when it equals the base or continues it at a `/`, `?` or `#`. I changed `src/utils.ts` and didn't commit anything.

I added a small `isUnderBase` helper there and used it in both functions. I checked your cases with a throwaway test, which I deleted afterwards:

- `withoutBase('/admin-dashboard', '/admin/')` now returns `/admin-dashboard`.
- `withBase('/admin-dashboard', '/admin/')` now returns `/admin/admin-dashboard`.
- Paths under the base behave as before: `/admin` gives `/`, `/admin?x` gives `/?x`, and `/admin/dashboard` gives `/dashboard`.
- `withBase('/admin?x', '/admin/')` still returns `/admin?x`.

The existing suite passes. I didn't add a permanent test because you didn't ask for one. I didn't run a Nuxt build, so I haven't confirmed the stray `-dashboard` file is gone from `nuxt generate`.

</details>

### claude, all: pass

Files: [src/utils.ts](../all/claude/ts-ufo-base-prefix-1/files/src/utils.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..255d85a 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -272,6 +272,16 @@ export function cleanDoubleSlashes(input = ""): string {
     .join("://");
 }
 
+/**
+ * Checks if input equals base or continues it at a segment, query or hash boundary.
+ *
+ * @param input - URL or pathname to check.
+ * @param base - Base without trailing slash.
+ */
+function isUnderBase(input: string, base: string): boolean {
+  return input.startsWith(base) && !/^[^/?#]/.test(input.slice(base.length));
+}
+
 /**
  * Ensures the URL or pathname starts with base.
  *
@@ -292,7 +302,7 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (isUnderBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
@@ -316,7 +326,7 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!isUnderBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
```

</details>

<details><summary>reply</summary>

Done. Added `isUnderBase` in `src/utils.ts`. `withBase` and `withoutBase` now match only at a `/`, `?`, `#` or end boundary. Existing 477 tests pass. I added no new tests and didn't run your two repro calls.

</details>

### codex, base: pass

Files: [src/utils.ts](../base/codex/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../base/codex/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..bfa1d35 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,7 +292,7 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (hasBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
@@ -316,13 +316,21 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!hasBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
   return trimmed[0] === "/" ? trimmed : "/" + trimmed;
 }
 
+function hasBase(input: string, base: string): boolean {
+  if (!input.startsWith(base)) {
+    return false;
+  }
+  const next = input[base.length];
+  return next === undefined || next === "/" || next === "?" || next === "#";
+}
+
 /**
  * Add/Replace the query section of the URL.
  *
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..77de687 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -1,6 +1,23 @@
 import { describe, expect, test } from "vitest";
 import { withBase, withoutBase } from "../src";
 
+describe.each(["/admin", "/admin/"])("base boundaries (%s)", (base) => {
+  test.each([
+    ["/admin-dashboard", "/admin/admin-dashboard", "/admin-dashboard"],
+    ["/administrator", "/admin/administrator", "/administrator"],
+    ["/admin.json", "/admin/admin.json", "/admin.json"],
+    ["/admin", "/admin", "/"],
+    ["/admin/", "/admin/", "/"],
+    ["/admin/dashboard", "/admin/dashboard", "/dashboard"],
+    ["/admin?x", "/admin?x", "/?x"],
+    ["/admin#section", "/admin#section", "/#section"],
+    ["/admin?x#section", "/admin?x#section", "/?x#section"],
+  ])("%s", (input, added, removed) => {
+    expect(withBase(input, base)).toBe(added);
+    expect(withoutBase(input, base)).toBe(removed);
+  });
+});
+
 describe("withBase", () => {
   const tests = [
     { base: "/", input: "/", out: "/" },
```

</details>

<details><summary>reply</summary>

I’ll check the base-path matching logic, add regression coverage, and run the tests.

Fixed both functions to match the base only at a path boundary: end of input, `/`, `?`, or `#`.

Added regression tests for prefix collisions and valid base paths, with and without trailing slashes.

Validation passed: all 497 tests, type checking, ESLint, and formatting.

</details>

### codex, muffle: pass

Files: [src/utils.ts](../muffle/codex/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../muffle/codex/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..c9471d5 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,12 +292,20 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (_hasBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
 }
 
+function _hasBase(input: string, base: string): boolean {
+  if (!input.startsWith(base)) {
+    return false;
+  }
+  const next = input[base.length];
+  return !next || next === "/" || next === "?" || next === "#";
+}
+
 /**
  * Removes the base from the URL or pathname.
  *
@@ -316,7 +324,7 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!_hasBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..c651f6c 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -3,6 +3,36 @@ import { withBase, withoutBase } from "../src";
 
 describe("withBase", () => {
   const tests = [
+    {
+      base: "/admin",
+      input: "/admin-dashboard",
+      out: "/admin/admin-dashboard",
+    },
+    { base: "/admin", input: "/administrator", out: "/admin/administrator" },
+    {
+      base: "/admin",
+      input: "/admin%2Fdashboard",
+      out: "/admin/admin%2Fdashboard",
+    },
+    { base: "/admin", input: "/admin", out: "/admin" },
+    { base: "/admin", input: "/admin/dashboard", out: "/admin/dashboard" },
+    { base: "/admin", input: "/admin?x", out: "/admin?x" },
+    { base: "/admin", input: "/admin#section", out: "/admin#section" },
+    {
+      base: "/admin/",
+      input: "/admin-dashboard",
+      out: "/admin/admin-dashboard",
+    },
+    { base: "/admin/", input: "/administrator", out: "/admin/administrator" },
+    {
+      base: "/admin/",
+      input: "/admin%2Fdashboard",
+      out: "/admin/admin%2Fdashboard",
+    },
+    { base: "/admin/", input: "/admin", out: "/admin" },
+    { base: "/admin/", input: "/admin/dashboard", out: "/admin/dashboard" },
+    { base: "/admin/", input: "/admin?x", out: "/admin?x" },
+    { base: "/admin/", input: "/admin#section", out: "/admin#section" },
     { base: "/", input: "/", out: "/" },
     { base: "/foo", input: "", out: "/foo" },
     { base: "/foo/", input: "/", out: "/foo" },
@@ -24,6 +54,20 @@ describe("withBase", () => {
 
 describe("withoutBase", () => {
   const tests = [
+    { base: "/admin", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin", input: "/administrator", out: "/administrator" },
+    { base: "/admin", input: "/admin%2Fdashboard", out: "/admin%2Fdashboard" },
+    { base: "/admin", input: "/admin", out: "/" },
+    { base: "/admin", input: "/admin/dashboard", out: "/dashboard" },
+    { base: "/admin", input: "/admin?x", out: "/?x" },
+    { base: "/admin", input: "/admin#section", out: "/#section" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin/", input: "/administrator", out: "/administrator" },
+    { base: "/admin/", input: "/admin%2Fdashboard", out: "/admin%2Fdashboard" },
+    { base: "/admin/", input: "/admin", out: "/" },
+    { base: "/admin/", input: "/admin/dashboard", out: "/dashboard" },
+    { base: "/admin/", input: "/admin?x", out: "/?x" },
+    { base: "/admin/", input: "/admin#section", out: "/#section" },
     { base: "/", input: "/", out: "/" },
     { base: "/foo", input: "/", out: "/" },
     { base: "/foo/", input: "/", out: "/" },
```

</details>

<details><summary>reply</summary>

I’ll check the base-matching logic, fix the path boundary check, and add regression tests for these cases.

Fixed both functions to require a boundary after the base: end of input, `/`, `?`, or `#`.

Added regression coverage for prefix collisions, trailing slashes, queries, and fragments. Your `/admin-dashboard` examples now return the expected results.

Validation passed: lint, formatting, all 507 tests, and type checking.

</details>

### codex, hush: pass

Files: [src/utils.ts](../hush/codex/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../hush/codex/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..bfa1d35 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,7 +292,7 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (hasBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
@@ -316,13 +316,21 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!hasBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
   return trimmed[0] === "/" ? trimmed : "/" + trimmed;
 }
 
+function hasBase(input: string, base: string): boolean {
+  if (!input.startsWith(base)) {
+    return false;
+  }
+  const next = input[base.length];
+  return next === undefined || next === "/" || next === "?" || next === "#";
+}
+
 /**
  * Add/Replace the query section of the URL.
  *
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..c44ee75 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -1,6 +1,28 @@
 import { describe, expect, test } from "vitest";
 import { withBase, withoutBase } from "../src";
 
+describe("base path boundaries", () => {
+  for (const base of ["/admin", "/admin/"]) {
+    for (const suffix of ["-dashboard", "istrator", "%2Fdashboard"]) {
+      const input = `/admin${suffix}`;
+      test(`${base} does not contain ${input}`, () => {
+        expect(withoutBase(input, base)).toBe(input);
+        expect(withBase(input, base)).toBe(`/admin${input}`);
+      });
+    }
+
+    for (const suffix of ["", "/dashboard", "?x", "#section"]) {
+      const input = `/admin${suffix}`;
+      test(`${base} contains ${input}`, () => {
+        expect(withoutBase(input, base)).toBe(
+          suffix.startsWith("/") ? suffix : `/${suffix}`,
+        );
+        expect(withBase(input, base)).toBe(input);
+      });
+    }
+  }
+});
+
 describe("withBase", () => {
   const tests = [
     { base: "/", input: "/", out: "/" },
```

</details>

<details><summary>reply</summary>

Base matching needs path boundaries. Checking helpers and tests.


Done.
Fixed base path boundaries; added regression tests. Lint, formatting, types, 493 tests passed via local binaries; `pnpm` unavailable.

</details>

### codex, sloth: pass

Files: [README.md](../sloth/codex/ts-ufo-base-prefix-1/files/README.md), [src/utils.ts](../sloth/codex/ts-ufo-base-prefix-1/files/src/utils.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 4a26073..d703492 100644
--- a/README.md
+++ b/README.md
@@ -408,7 +408,7 @@ resolveURL("http://foo.com/foo?test=123#token", "bar", "baz");
 
 Ensures the URL or pathname starts with base.
 
-If input already starts with base, it will not be added again.
+If input already starts with base at a path boundary, it will not be added again.
 
 **Example:**
 
@@ -464,7 +464,7 @@ withLeadingSlash("foo"); // "/foo"
 
 Removes the base from the URL or pathname.
 
-If input does not start with base, it will not be removed.
+If input does not start with base at a path boundary, it will not be removed.
 
 **Example:**
 
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..1f162af 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -275,7 +275,7 @@ export function cleanDoubleSlashes(input = ""): string {
 /**
  * Ensures the URL or pathname starts with base.
  *
- * If input already starts with base, it will not be added again.
+ * If input already starts with base at a path boundary, it will not be added again.
  *
  * @example
  *
@@ -292,7 +292,7 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (_hasBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
@@ -301,7 +301,7 @@ export function withBase(input: string, base: string) {
 /**
  * Removes the base from the URL or pathname.
  *
- * If input does not start with base, it will not be removed.
+ * If input does not start with base at a path boundary, it will not be removed.
  *
  * @example
  *
@@ -316,13 +316,21 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!_hasBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
   return trimmed[0] === "/" ? trimmed : "/" + trimmed;
 }
 
+/** Checks if input starts with base at a path boundary. */
+function _hasBase(input: string, base: string): boolean {
+  return (
+    input.startsWith(base) &&
+    (!input[base.length] || "/?#".includes(input[base.length]))
+  );
+}
+
 /**
  * Add/Replace the query section of the URL.
  *
```

</details>

<details><summary>reply</summary>

I’ll check both helpers and their callers, fix the shared boundary check, then run the build and existing tests.

Both helpers use the same prefix-only check in `src/utils.ts`. I’ll replace it with a shared check that requires the base to end at `/`, `?`, `#`, or the end of the input. Existing exports, callers, tests, fixtures, and config need no changes; no new options or dependencies are needed.

Fixed both helpers with a shared path-boundary check. `/admin-dashboard` now stays unchanged with `withoutBase` and becomes `/admin/admin-dashboard` with `withBase`. Exact matches, nested paths, queries, and fragments retain their behavior.

Build, lint, type checks, and all 479 existing tests passed. Also verified your examples against the built output. Used local tools because `pnpm` was unavailable.

</details>

### codex, all: pass

Files: [src/utils.ts](../all/codex/ts-ufo-base-prefix-1/files/src/utils.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..4dc9720 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,7 +292,10 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (
+    input.startsWith(_base) &&
+    (!input[_base.length] || "/?#".includes(input[_base.length]))
+  ) {
     return input;
   }
   return joinURL(_base, input);
@@ -316,7 +319,10 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (
+    !input.startsWith(_base) ||
+    (input[_base.length] && !"/?#".includes(input[_base.length]))
+  ) {
     return input;
   }
   const trimmed = input.slice(_base.length);
```

</details>

<details><summary>reply</summary>

Done.
`withBase` and `withoutBase` require path boundaries. Build, lint, 479 tests, typecheck, and reported-case checks passed.

</details>
