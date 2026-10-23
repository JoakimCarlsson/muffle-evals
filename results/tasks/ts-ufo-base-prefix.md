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
| claude | muffle | pass | +10/-2 | 4 | 1,648 | $0.067 |
| claude | hush | pass | +10/-2 | 2 | 1,557 | $0.050 |
| claude | sloth | pass | +12/-2 | 9 | 1,770 | $0.075 |
| claude | all | pass | +15/-2 | 8 | 1,679 | $0.072 |
| codex | base | pass | +10/-2 | 17 | 1,218 | - |
| codex | muffle | pass | +10/-2 | 22 | 1,123 | - |
| codex | hush | pass | +10/-2 | 22 | 1,079 | - |
| codex | sloth | pass | +5/-2 | 23 | 1,244 | - |
| codex | all | pass | +10/-2 | 44 | 1,061 | - |

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
index db7c2c2..f950431 100644
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
+  return next === undefined || next === "/" || next === "?" || next === "#";
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
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..b8f3eb0 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -13,6 +13,8 @@ describe("withBase", () => {
     { base: "/base/", input: "/base/a", out: "/base/a" },
     { base: "/base/", input: "https://test.com", out: "https://test.com" },
     { base: "/", input: "https://test.com", out: "https://test.com" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin/admin-dashboard" },
+    { base: "/admin/", input: "/admin?x", out: "/admin?x" },
   ];
 
   for (const t of tests) {
@@ -33,6 +35,8 @@ describe("withoutBase", () => {
     { base: "/base", input: "/base/a", out: "/a" },
     { base: "/base/", input: "/base/a", out: "/a" },
     { base: "/base/a/", input: "/base/a", out: "/" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin/", input: "/admin?x", out: "/?x" },
     { base: "/", input: "/test/", out: "/test/" },
     { base: "/", input: "/?test", out: "/?test" },
     { base: "/api", input: "/api?test", out: "/?test" },
```

</details>

<details><summary>reply</summary>

I fixed `withBase` and `withoutBase` in `src/utils.ts`. A path now counts as under the base only if it equals the base or the base is followed by `/`, `?` or `#`. The full test suite passes.

- `withoutBase('/admin-dashboard', '/admin/')` now returns `/admin-dashboard`.
- `withBase('/admin-dashboard', '/admin/')` now returns `/admin/admin-dashboard`.
- `/admin`, `/admin/dashboard` and `/admin?x` behave as before.

I added test cases for the prefix-only path and the `?x` case to `test/base.test.ts`. I haven't tried it in your Nuxt app, so `nuxt generate` still needs to be run against the fixed ufo to confirm the stray `-dashboard` file is gone.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [src/utils.ts](../hush/claude/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../hush/claude/ts-ufo-base-prefix-1/files/test/base.test.ts)

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
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..6e10deb 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -13,6 +13,7 @@ describe("withBase", () => {
     { base: "/base/", input: "/base/a", out: "/base/a" },
     { base: "/base/", input: "https://test.com", out: "https://test.com" },
     { base: "/", input: "https://test.com", out: "https://test.com" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin/admin-dashboard" },
   ];
 
   for (const t of tests) {
@@ -38,6 +39,7 @@ describe("withoutBase", () => {
     { base: "/api", input: "/api?test", out: "/?test" },
     { base: "/base/", input: "https://test.com", out: "https://test.com" },
     { base: "/", input: "https://test.com", out: "https://test.com" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin-dashboard" },
   ];
 
   for (const t of tests) {
```

</details>

<details><summary>reply</summary>

Done. Added `isUnderBase` in `src/utils.ts`: base match needs end of input, `/`, `?` or `#` next. `withBase` and `withoutBase` use it. Added `/admin-dashboard` cases to `test/base.test.ts`; full suite passed before the test edit, `base.test.ts` passes after. Not committed.

</details>

### claude, sloth: pass

Files: [src/utils.ts](../sloth/claude/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../sloth/claude/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..f169722 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,12 +292,22 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (isUnderBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
 }
 
+/**
+ * Checks if the input is the base itself or continues it at a segment, query or hash boundary.
+ */
+function isUnderBase(input: string, base: string) {
+  return (
+    input.startsWith(base) &&
+    (input.length === base.length || "/?#".includes(input[base.length]))
+  );
+}
+
 /**
  * Removes the base from the URL or pathname.
  *
@@ -316,7 +326,7 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!isUnderBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..f9cb198 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -11,6 +11,12 @@ describe("withBase", () => {
     { base: "/base", input: "/base/", out: "/base/" },
     { base: "/base", input: "/base/a", out: "/base/a" },
     { base: "/base/", input: "/base/a", out: "/base/a" },
+    {
+      base: "/admin/",
+      input: "/admin-dashboard",
+      out: "/admin/admin-dashboard",
+    },
+    { base: "/admin/", input: "/admin?x", out: "/admin?x" },
     { base: "/base/", input: "https://test.com", out: "https://test.com" },
     { base: "/", input: "https://test.com", out: "https://test.com" },
   ];
@@ -36,6 +42,9 @@ describe("withoutBase", () => {
     { base: "/", input: "/test/", out: "/test/" },
     { base: "/", input: "/?test", out: "/?test" },
     { base: "/api", input: "/api?test", out: "/?test" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin/", input: "/admin/dashboard", out: "/dashboard" },
+    { base: "/admin/", input: "/admin#x", out: "/#x" },
     { base: "/base/", input: "https://test.com", out: "https://test.com" },
     { base: "/", input: "https://test.com", out: "https://test.com" },
   ];
```

</details>

<details><summary>reply</summary>

`withBase` and `withoutBase` now only treat a path as under the base when it equals the base or continues it at a `/`, `?` or `#`. The existing tests and the new cases pass, but `tsc` printed no type errors and I didn't confirm it ran cleanly.

- **Your examples:** `withoutBase('/admin-dashboard', '/admin/')` now returns `/admin-dashboard`. `withBase('/admin-dashboard', '/admin/')` now returns `/admin/admin-dashboard`.
- **Paths under the base:** `/admin`, `/admin/dashboard` and `/admin?x` behave as before.
- **Where the fix is:** a small private helper, `isUnderBase`, in `src/utils.ts`. Both functions call it in place of the plain `startsWith` check.
- **Tests:** I added cases to `test/base.test.ts` for the prefix-only path, a path under the base, and the `?` and `#` boundaries.

I didn't commit anything.

</details>

### claude, all: pass

Files: [src/utils.ts](../all/claude/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../all/claude/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..737b8e6 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,12 +292,25 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (isUnderBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
 }
 
+/**
+ * Checks that input is the base itself or continues it at a segment, query or hash boundary.
+ *
+ * @param input - URL or pathname.
+ * @param base - Base without trailing slash.
+ */
+function isUnderBase(input: string, base: string) {
+  return (
+    input.startsWith(base) &&
+    (input.length === base.length || "/?#".includes(input[base.length]!))
+  );
+}
+
 /**
  * Removes the base from the URL or pathname.
  *
@@ -316,7 +329,7 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!isUnderBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..9991a75 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -11,6 +11,12 @@ describe("withBase", () => {
     { base: "/base", input: "/base/", out: "/base/" },
     { base: "/base", input: "/base/a", out: "/base/a" },
     { base: "/base/", input: "/base/a", out: "/base/a" },
+    {
+      base: "/admin/",
+      input: "/admin-dashboard",
+      out: "/admin/admin-dashboard",
+    },
+    { base: "/admin/", input: "/admin?x", out: "/admin?x" },
     { base: "/base/", input: "https://test.com", out: "https://test.com" },
     { base: "/", input: "https://test.com", out: "https://test.com" },
   ];
@@ -36,6 +42,8 @@ describe("withoutBase", () => {
     { base: "/", input: "/test/", out: "/test/" },
     { base: "/", input: "/?test", out: "/?test" },
     { base: "/api", input: "/api?test", out: "/?test" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin/", input: "/admin/dashboard", out: "/dashboard" },
     { base: "/base/", input: "https://test.com", out: "https://test.com" },
     { base: "/", input: "https://test.com", out: "https://test.com" },
   ];
```

</details>

<details><summary>reply</summary>

Done. `withBase` and `withoutBase` now treat a path as under the base only at a `/`, `?` or `#` boundary, or on an exact match. The fix is a new `isUnderBase` helper in `src/utils.ts`, and I added test cases for `/admin-dashboard`, `/admin?x` and `/admin/dashboard`. All 481 tests pass. The `tsc --noEmit` run printed no errors, but npm printed a notice and no compiler output, so I'm not certain it ran. Not committed.

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
index db7c2c2..c7b718c 100644
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
+  return !next || next === "/" || next === "?" || next === "#";
+}
+
 /**
  * Add/Replace the query section of the URL.
  *
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..970c79b 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -1,6 +1,28 @@
 import { describe, expect, test } from "vitest";
 import { withBase, withoutBase } from "../src";
 
+describe("base boundaries", () => {
+  for (const base of ["/admin", "/admin/"]) {
+    for (const suffix of ["-dashboard", "istrator", ".html", "%2Fdashboard"]) {
+      const input = `/admin${suffix}`;
+      test(`${base} does not match ${input}`, () => {
+        expect(withoutBase(input, base)).toBe(input);
+        expect(withBase(input, base)).toBe(`/admin${input}`);
+      });
+    }
+
+    for (const suffix of ["", "/dashboard", "?x", "#section"]) {
+      const input = `/admin${suffix}`;
+      test(`${base} matches ${input}`, () => {
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

I’ll check the base-matching logic, add regression tests for the prefix collision, and run the relevant checks.

Fixed both functions to require a boundary after the base: end of input, `/`, `?`, or `#`.

`/admin-dashboard` now stays unchanged with `withoutBase` and becomes `/admin/admin-dashboard` with `withBase`. Existing base-path behavior is preserved.

Added regression coverage. All 495 tests, type checks, lint, and formatting passed.

</details>

### codex, hush: pass

Files: [src/utils.ts](../hush/codex/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../hush/codex/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..c7b718c 100644
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
+  return !next || next === "/" || next === "?" || next === "#";
+}
+
 /**
  * Add/Replace the query section of the URL.
  *
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..105f743 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -1,6 +1,28 @@
 import { describe, expect, test } from "vitest";
 import { withBase, withoutBase } from "../src";
 
+describe("base boundaries", () => {
+  for (const base of ["/admin", "/admin/"]) {
+    for (const suffix of ["-dashboard", "istrator", ".html", "%2Fdashboard"]) {
+      test(`${base} does not contain /admin${suffix}`, () => {
+        const input = `/admin${suffix}`;
+        expect(withoutBase(input, base)).toBe(input);
+        expect(withBase(input, base)).toBe(`/admin${input}`);
+      });
+    }
+
+    for (const suffix of ["", "/", "/dashboard", "?x", "#section"]) {
+      test(`${base} contains /admin${suffix}`, () => {
+        const input = `/admin${suffix}`;
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

Done.
`withBase`/`withoutBase` now check path boundaries. Regression tests added; 497 tests, typecheck, ESLint, Prettier passed.

</details>

### codex, sloth: pass

Files: [src/utils.ts](../sloth/codex/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../sloth/codex/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..1a44b67 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,7 +292,7 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (input.startsWith(_base) && /^([/?#]|$)/.test(input.slice(_base.length))) {
     return input;
   }
   return joinURL(_base, input);
@@ -316,7 +316,10 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (
+    !input.startsWith(_base) ||
+    !/^([/?#]|$)/.test(input.slice(_base.length))
+  ) {
     return input;
   }
   const trimmed = input.slice(_base.length);
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..241c664 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -1,6 +1,29 @@
 import { describe, expect, test } from "vitest";
 import { withBase, withoutBase } from "../src";
 
+test("base prefixes must end at a path boundary", () => {
+  for (const base of ["/admin", "/admin/"]) {
+    for (const input of [
+      "/admin-dashboard",
+      "/administrator",
+      "/admin%2Fdashboard",
+    ]) {
+      expect(withoutBase(input, base)).toBe(input);
+      expect(withBase(input, base)).toBe("/admin" + input);
+    }
+    for (const [input, output] of [
+      ["/admin", "/"],
+      ["/admin/", "/"],
+      ["/admin/dashboard", "/dashboard"],
+      ["/admin?x", "/?x"],
+      ["/admin#x", "/#x"],
+    ]) {
+      expect(withoutBase(input, base)).toBe(output);
+      expect(withBase(input, base)).toBe(input);
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

I’ll check both helpers and their callers, add a regression test for the path boundary, then run the tests and build.

The change is limited to the two helpers in `src/utils.ts` and the existing base tests. There are no internal callers or signatures to update. I’ll require the prefix to end at the path’s end, `/`, `?`, or `#`, preserving query and fragment handling. No new API or dependency is needed.

Fixed both helpers to require a boundary after the base: end of input, `/`, `?`, or `#`.

Your examples now return the expected results. Regression coverage includes partial prefixes, actual child paths, queries, and fragments, with and without trailing slashes on the base.

Validation passed: lint, all 480 tests, type checks, and build.

</details>

### codex, all: pass

Files: [src/utils.ts](../all/codex/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../all/codex/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..52c9167 100644
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
 
+/** Checks whether input starts with a complete base path. */
+function hasBase(input: string, base: string): boolean {
+  return (
+    input.startsWith(base) &&
+    (!input[base.length] || /[/?#]/.test(input[base.length]))
+  );
+}
+
 /**
  * Add/Replace the query section of the URL.
  *
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..ff6e87f 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -4,6 +4,36 @@ import { withBase, withoutBase } from "../src";
 describe("withBase", () => {
   const tests = [
     { base: "/", input: "/", out: "/" },
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
+    { base: "/admin", input: "/admin#x", out: "/admin#x" },
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
+    { base: "/admin/", input: "/admin#x", out: "/admin#x" },
     { base: "/foo", input: "", out: "/foo" },
     { base: "/foo/", input: "/", out: "/foo" },
     { base: "/foo", input: "/bar", out: "/foo/bar" },
@@ -25,6 +55,20 @@ describe("withBase", () => {
 describe("withoutBase", () => {
   const tests = [
     { base: "/", input: "/", out: "/" },
+    { base: "/admin", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin", input: "/administrator", out: "/administrator" },
+    { base: "/admin", input: "/admin%2Fdashboard", out: "/admin%2Fdashboard" },
+    { base: "/admin", input: "/admin", out: "/" },
+    { base: "/admin", input: "/admin/dashboard", out: "/dashboard" },
+    { base: "/admin", input: "/admin?x", out: "/?x" },
+    { base: "/admin", input: "/admin#x", out: "/#x" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin/", input: "/administrator", out: "/administrator" },
+    { base: "/admin/", input: "/admin%2Fdashboard", out: "/admin%2Fdashboard" },
+    { base: "/admin/", input: "/admin", out: "/" },
+    { base: "/admin/", input: "/admin/dashboard", out: "/dashboard" },
+    { base: "/admin/", input: "/admin?x", out: "/?x" },
+    { base: "/admin/", input: "/admin#x", out: "/#x" },
     { base: "/foo", input: "/", out: "/" },
     { base: "/foo/", input: "/", out: "/" },
     { base: "/foo", input: "/bar", out: "/bar" },
```

</details>

<details><summary>reply</summary>

Done.
`withBase` and `withoutBase` now respect path boundaries. Added regression cases; 507 tests, type checks, lint, and build passed.

</details>
