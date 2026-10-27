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
| claude | base | pass | +10/-2 | 5 | 1,907 | $0.087 |
| claude | muffle | pass | +11/-2 | 5 | 2,196 | $0.077 |
| claude | hush | pass | +10/-2 | 0 | 760 | $0.062 |
| claude | sloth | pass | +11/-2 | 6 | 1,991 | $0.122 |
| claude | all | pass | +11/-2 | 9 | 1,099 | $0.104 |
| codex | base | pass | +10/-2 | 21 | 1,294 | - |
| codex | muffle | pass | +11/-2 | 26 | 1,036 | - |
| codex | hush | pass | +10/-2 | 32 | 843 | - |
| codex | sloth | pass | +8/-2 | 32 | 1,202 | - |
| codex | all | pass | +8/-2 | 28 | 940 | - |

### claude, base: pass

Files: [src/utils.ts](../base/claude/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../base/claude/ts-ufo-base-prefix-1/files/test/base.test.ts)

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
index ed684d1..fdff226 100644
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
@@ -38,6 +40,9 @@ describe("withoutBase", () => {
     { base: "/api", input: "/api?test", out: "/?test" },
     { base: "/base/", input: "https://test.com", out: "https://test.com" },
     { base: "/", input: "https://test.com", out: "https://test.com" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin/", input: "/admin/dashboard", out: "/dashboard" },
+    { base: "/admin/", input: "/admin?x", out: "/?x" },
   ];
 
   for (const t of tests) {
```

</details>

<details><summary>reply</summary>

Now add regression tests.

I fixed both functions in `src/utils.ts`. `withoutBase('/admin-dashboard', '/admin/')` now returns `/admin-dashboard`, and `withBase('/admin-dashboard', '/admin/')` returns `/admin/admin-dashboard`.

Both functions now use a small shared helper, `isUnderBase`. It treats a path as under the base only when it equals the base or the next character is `/`, `?` or `#`. Paths like `/admin`, `/admin/dashboard` and `/admin?x` still behave as before.

I added regression tests for these cases to `test/base.test.ts`. The full suite passes (482 tests) and eslint reports no errors. I haven't tested this inside a Nuxt `nuxt generate` build, so I haven't confirmed the `-dashboard` stub file is gone there.

I didn't commit anything.

</details>

### claude, muffle: pass

Files: [src/utils.ts](../muffle/claude/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../muffle/claude/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..82d14bc 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,12 +292,21 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (isUnderBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
 }
 
+// `base` must have no trailing slash. Matches only on a path segment boundary.
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
@@ -316,7 +325,7 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!isUnderBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..72e567a 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -13,6 +13,7 @@ describe("withBase", () => {
     { base: "/base/", input: "/base/a", out: "/base/a" },
     { base: "/base/", input: "https://test.com", out: "https://test.com" },
     { base: "/", input: "https://test.com", out: "https://test.com" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin/admin-dashboard" },
   ];
 
   for (const t of tests) {
@@ -38,6 +39,10 @@ describe("withoutBase", () => {
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

Fixed and tested. Nothing is committed.

`withBase` and `withoutBase` in `src/utils.ts` now treat a path as under the base only if the base is followed by the end of the string, `/`, `?` or `#`. This comes from a small `isUnderBase` helper that both functions use.

- `withoutBase('/admin-dashboard', '/admin/')` now returns `/admin-dashboard`.
- `withBase('/admin-dashboard', '/admin/')` now returns `/admin/admin-dashboard`.
- `/admin`, `/admin/dashboard` and `/admin?x` behave as before.

I added five cases to `test/base.test.ts`: your two examples plus the three paths that should keep working. The full suite passes (482 tests).

I didn't run `nuxt generate` against the fix, so the stray `-dashboard` stub is untested on your app.

</details>

### claude, hush: pass

Files: [src/utils.ts](../hush/claude/ts-ufo-base-prefix-1/files/src/utils.ts)

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
```

</details>

<details><summary>reply</summary>

Done. `withBase` and `withoutBase` now treat input as under the base only when it equals the base or continues with `/`, `?` or `#`, via a new `isUnderBase` helper in `src/utils.ts`. The existing tests pass (477). I didn't add a test for `/admin-dashboard` or run your two examples.

</details>

### claude, sloth: pass

Files: [src/utils.ts](../sloth/claude/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../sloth/claude/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..532192a 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -272,6 +272,15 @@ export function cleanDoubleSlashes(input = ""): string {
     .join("://");
 }
 
+/**
+ * Checks that input is the base itself or continues past it at a path, query or hash boundary.
+ */
+function isUnderBase(input: string, base: string) {
+  return (
+    input.startsWith(base) && (input.length === base.length || "/?#".includes(input[base.length]))
+  );
+}
+
 /**
  * Ensures the URL or pathname starts with base.
  *
@@ -292,7 +301,7 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (isUnderBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
@@ -316,7 +325,7 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!isUnderBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..ce2e9ca 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -11,6 +11,8 @@ describe("withBase", () => {
     { base: "/base", input: "/base/", out: "/base/" },
     { base: "/base", input: "/base/a", out: "/base/a" },
     { base: "/base/", input: "/base/a", out: "/base/a" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin/admin-dashboard" },
+    { base: "/admin/", input: "/admin?x", out: "/admin?x" },
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

I put the helper between withBase's doc comment and the function. I'll move it above the doc comment.

`withBase` and `withoutBase` now only treat a path as under the base when it equals the base or continues past it at a `/`, `?` or `#`. The full vitest suite passes, 483 tests. I didn't run lint or the type check.

- **Fix:** a new `isUnderBase` helper in `src/utils.ts` replaces the plain `startsWith` check in both functions.
- **Your examples:**
  - `withoutBase('/admin-dashboard', '/admin/')` now returns `/admin-dashboard`.
  - `withBase('/admin-dashboard', '/admin/')` now returns `/admin/admin-dashboard`.
  - `/admin`, `/admin/dashboard` and `/admin?x` behave as before.
- **Tests:** I added cases for all of these to `test/base.test.ts`.

</details>

### claude, all: pass

Files: [src/utils.ts](../all/claude/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../all/claude/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..00968c4 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,12 +292,21 @@ export function withBase(input: string, base: string) {
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
+ * Checks that input equals base or continues it at a path, query or hash boundary.
+ */
+function isUnderBase(input: string, base: string) {
+  return (
+    input.startsWith(base) && (!input[base.length] || "/?#".includes(input[base.length]))
+  );
+}
+
 /**
  * Removes the base from the URL or pathname.
  *
@@ -316,7 +325,7 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!isUnderBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..4b36baf 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -46,3 +46,12 @@ describe("withoutBase", () => {
     });
   }
 });
+
+describe("base prefix", () => {
+  test("does not treat a shared prefix as under base", () => {
+    expect(withoutBase("/admin-dashboard", "/admin/")).toBe("/admin-dashboard");
+    expect(withBase("/admin-dashboard", "/admin/")).toBe("/admin/admin-dashboard");
+    expect(withoutBase("/admin?x", "/admin/")).toBe("/?x");
+    expect(withBase("/admin/dashboard", "/admin/")).toBe("/admin/dashboard");
+  });
+});
```

</details>

<details><summary>reply</summary>

Done. `withBase` and `withoutBase` now only treat input as under the base when it equals the base or continues it at `/`, `?` or `#` (`src/utils.ts`). I added a test in `test/base.test.ts`, and the full suite passes. Lint and typecheck not run.

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
index ed684d1..0ba3f0f 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -1,6 +1,27 @@
 import { describe, expect, test } from "vitest";
 import { withBase, withoutBase } from "../src";
 
+describe.each(["/admin", "/admin/"])("base boundaries (%s)", (base) => {
+  test.each([
+    ["/admin-dashboard", "/admin/admin-dashboard", "/admin-dashboard"],
+    ["/administrator", "/admin/administrator", "/administrator"],
+    [
+      "/admin-dashboard?x#y",
+      "/admin/admin-dashboard?x#y",
+      "/admin-dashboard?x#y",
+    ],
+    ["/admin", "/admin", "/"],
+    ["/admin/", "/admin/", "/"],
+    ["/admin/dashboard", "/admin/dashboard", "/dashboard"],
+    ["/admin?x", "/admin?x", "/?x"],
+    ["/admin#section", "/admin#section", "/#section"],
+    ["/admin?x#section", "/admin?x#section", "/?x#section"],
+  ])("%s", (input, prefixed, stripped) => {
+    expect(withBase(input, base)).toBe(prefixed);
+    expect(withoutBase(input, base)).toBe(stripped);
+  });
+});
+
 describe("withBase", () => {
   const tests = [
     { base: "/", input: "/", out: "/" },
```

</details>

<details><summary>reply</summary>

I’ll check the base-path matching logic and tests, then update it to respect path boundaries.

Fixed both functions to require a boundary after the base: end of input, `/`, `?`, or `#`.

`/admin-dashboard` now stays unchanged with `withoutBase` and becomes `/admin/admin-dashboard` with `withBase`. Existing base paths, queries, and fragments still work.

Added regression coverage for bases with and without trailing slashes. All 497 tests, type checks, lint, and formatting checks pass.

</details>

### codex, muffle: pass

Files: [src/utils.ts](../muffle/codex/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../muffle/codex/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..33b69ff 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,12 +292,21 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (hasBase(input, _base)) {
     return input;
   }
   return joinURL(_base, input);
 }
 
+// The base must match a complete path segment, allowing query and hash suffixes.
+function hasBase(input: string, base: string): boolean {
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
@@ -316,7 +325,7 @@ export function withoutBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (!input.startsWith(_base)) {
+  if (!hasBase(input, _base)) {
     return input;
   }
   const trimmed = input.slice(_base.length);
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..ab08310 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -46,3 +46,29 @@ describe("withoutBase", () => {
     });
   }
 });
+
+describe("base path boundaries", () => {
+  for (const base of ["/admin", "/admin/"]) {
+    for (const input of [
+      "/admin-dashboard",
+      "/administrator",
+      "/admin.json",
+      "/admin%2Fdashboard",
+    ]) {
+      test(`${input} is outside ${base}`, () => {
+        expect(withoutBase(input, base)).toBe(input);
+        expect(withBase(input, base)).toBe(`/admin${input}`);
+      });
+    }
+
+    for (const suffix of ["", "/dashboard", "?x", "#section", "?x#section"]) {
+      const input = `/admin${suffix}`;
+      test(`${input} is under ${base}`, () => {
+        expect(withoutBase(input, base)).toBe(
+          suffix.startsWith("/") ? suffix : `/${suffix}`,
+        );
+        expect(withBase(input, base)).toBe(input);
+      });
+    }
+  }
+});
```

</details>

<details><summary>reply</summary>

I’ll check how both helpers match the base, add regression coverage, and fix the path boundary check.

The regression tests reproduce the prefix bug with both `/admin` and `/admin/`. I’ll make both helpers require the base to end at the end of the input or before `/`, `?`, or `#`.

Fixed both helpers to match complete path segments, preserving query and hash suffixes.

- `withoutBase('/admin-dashboard', '/admin/')` returns `/admin-dashboard`.
- `withBase('/admin-dashboard', '/admin/')` returns `/admin/admin-dashboard`.

Added regression coverage for both base formats and valid matches. All 497 tests, type checks, lint, and formatting checks pass.

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
index ed684d1..6da8d62 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -46,3 +46,35 @@ describe("withoutBase", () => {
     });
   }
 });
+
+describe("base path boundaries", () => {
+  for (const base of ["/admin", "/admin/"]) {
+    for (const input of [
+      "/admin-dashboard",
+      "/administrator",
+      "/admin%2Fdashboard",
+    ]) {
+      test(`${base} does not match ${input}`, () => {
+        expect(withoutBase(input, base)).toBe(input);
+        expect(withBase(input, base)).toBe(`/admin${input}`);
+      });
+    }
+
+    for (const suffix of [
+      "",
+      "/",
+      "/dashboard",
+      "?x",
+      "#section",
+      "?x#section",
+    ]) {
+      test(`${base} matches /admin${suffix}`, () => {
+        const input = `/admin${suffix}`;
+        expect(withoutBase(input, base)).toBe(
+          suffix.startsWith("/") ? suffix : `/${suffix}`,
+        );
+        expect(withBase(input, base)).toBe(input);
+      });
+    }
+  }
+});
```

</details>

<details><summary>reply</summary>

Done.
`withBase` and `withoutBase` now respect path boundaries; regression tests added. All 497 tests, type checks, lint, and formatting pass.

</details>

### codex, sloth: pass

Files: [src/utils.ts](../sloth/codex/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../sloth/codex/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..db16f20 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,7 +292,10 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (
+    input.startsWith(_base) &&
+    (!input[_base.length] || /[/?#]/.test(input[_base.length]))
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
+    (input[_base.length] && !/[/?#]/.test(input[_base.length]))
+  ) {
     return input;
   }
   const trimmed = input.slice(_base.length);
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..c9160b2 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -3,6 +3,26 @@ import { withBase, withoutBase } from "../src";
 
 describe("withBase", () => {
   const tests = [
+    { base: "/admin/", input: "", out: "/admin" },
+    {
+      base: "/admin/",
+      input: "/admin-dashboard",
+      out: "/admin/admin-dashboard",
+    },
+    { base: "/admin/", input: "/admin", out: "/admin" },
+    { base: "/admin/", input: "/admin/dashboard", out: "/admin/dashboard" },
+    { base: "/admin/", input: "/admin?x", out: "/admin?x" },
+    { base: "/admin/", input: "/admin#x", out: "/admin#x" },
+    { base: "/admin", input: "", out: "/admin" },
+    {
+      base: "/admin",
+      input: "/admin-dashboard",
+      out: "/admin/admin-dashboard",
+    },
+    { base: "/admin", input: "/admin", out: "/admin" },
+    { base: "/admin", input: "/admin/dashboard", out: "/admin/dashboard" },
+    { base: "/admin", input: "/admin?x", out: "/admin?x" },
+    { base: "/admin", input: "/admin#x", out: "/admin#x" },
     { base: "/", input: "/", out: "/" },
     { base: "/foo", input: "", out: "/foo" },
     { base: "/foo/", input: "/", out: "/foo" },
@@ -24,6 +44,18 @@ describe("withBase", () => {
 
 describe("withoutBase", () => {
   const tests = [
+    { base: "/admin/", input: "", out: "" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin/", input: "/admin", out: "/" },
+    { base: "/admin/", input: "/admin/dashboard", out: "/dashboard" },
+    { base: "/admin/", input: "/admin?x", out: "/?x" },
+    { base: "/admin/", input: "/admin#x", out: "/#x" },
+    { base: "/admin", input: "", out: "" },
+    { base: "/admin", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin", input: "/admin", out: "/" },
+    { base: "/admin", input: "/admin/dashboard", out: "/dashboard" },
+    { base: "/admin", input: "/admin?x", out: "/?x" },
+    { base: "/admin", input: "/admin#x", out: "/#x" },
     { base: "/", input: "/", out: "/" },
     { base: "/foo", input: "/", out: "/" },
     { base: "/foo/", input: "/", out: "/" },
```

</details>

<details><summary>reply</summary>

I’ll check the base-matching logic and its tests, fix the boundary check, and run the build and relevant tests.

Both helpers now require the base prefix to end at `/`, `?`, `#`, or the end of the input. The tests cover your examples with and without the base’s trailing slash, plus empty input and fragments.

`pnpm` isn’t installed here, so I’ll run the build, lint, and tests using npm and the installed tools.

Fixed both helpers to match the base only at a path boundary. Your `/admin-dashboard` examples now return the expected values, while `/admin`, `/admin/dashboard`, and `/admin?x` retain their behavior.

Build, lint, all 503 tests, and type checks passed. Added regression coverage for both base spellings.

No new options or dependencies. Nuxt generation wasn’t run.

</details>

### codex, all: pass

Files: [src/utils.ts](../all/codex/ts-ufo-base-prefix-1/files/src/utils.ts), [test/base.test.ts](../all/codex/ts-ufo-base-prefix-1/files/test/base.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index db7c2c2..bcb5abd 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -292,7 +292,10 @@ export function withBase(input: string, base: string) {
     return input;
   }
   const _base = withoutTrailingSlash(base);
-  if (input.startsWith(_base)) {
+  if (
+    input.startsWith(_base) &&
+    /^(?:[/?#]|$)/.test(input.slice(_base.length))
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
+    !/^(?:[/?#]|$)/.test(input.slice(_base.length))
+  ) {
     return input;
   }
   const trimmed = input.slice(_base.length);
diff --git a/test/base.test.ts b/test/base.test.ts
index ed684d1..1706e73 100644
--- a/test/base.test.ts
+++ b/test/base.test.ts
@@ -3,6 +3,24 @@ import { withBase, withoutBase } from "../src";
 
 describe("withBase", () => {
   const tests = [
+    {
+      base: "/admin",
+      input: "/admin-dashboard",
+      out: "/admin/admin-dashboard",
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
+    { base: "/admin/", input: "/admin", out: "/admin" },
+    { base: "/admin/", input: "/admin/dashboard", out: "/admin/dashboard" },
+    { base: "/admin/", input: "/admin?x", out: "/admin?x" },
+    { base: "/admin/", input: "/admin#x", out: "/admin#x" },
     { base: "/", input: "/", out: "/" },
     { base: "/foo", input: "", out: "/foo" },
     { base: "/foo/", input: "/", out: "/foo" },
@@ -24,6 +42,16 @@ describe("withBase", () => {
 
 describe("withoutBase", () => {
   const tests = [
+    { base: "/admin", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin", input: "/admin", out: "/" },
+    { base: "/admin", input: "/admin/dashboard", out: "/dashboard" },
+    { base: "/admin", input: "/admin?x", out: "/?x" },
+    { base: "/admin", input: "/admin#x", out: "/#x" },
+    { base: "/admin/", input: "/admin-dashboard", out: "/admin-dashboard" },
+    { base: "/admin/", input: "/admin", out: "/" },
+    { base: "/admin/", input: "/admin/dashboard", out: "/dashboard" },
+    { base: "/admin/", input: "/admin?x", out: "/?x" },
+    { base: "/admin/", input: "/admin#x", out: "/#x" },
     { base: "/", input: "/", out: "/" },
     { base: "/foo", input: "/", out: "/" },
     { base: "/foo/", input: "/", out: "/" },
```

</details>

<details><summary>reply</summary>

Done.
`withBase` and `withoutBase` now respect path boundaries. Regression tests added; build, lint, typecheck, and all 499 tests passed.

</details>
