# ts-mlly-generic-export-names

Source: https://github.com/unjs/mlly/pull/341

## Prompt

> `findExports` reports generic type arguments as export names.
> 
> ```ts
> findExports("export const APP_MODE_MAP = new Map<string, IAppMode>()")
> // names: ["APP_MODE_MAP", "IAppMode"]   expected: ["APP_MODE_MAP"]
> ```
> 
> The comma inside `<string, IAppMode>` seems to be taken as a separator between declarations. The same happens with generic calls like `export const result = foo<Bar, Baz>(arg1, arg2)` and with several declarators, e.g. `export const a = new Set<string>(), b = new Map<string, number>()` should give `["a", "b"]`.
> 
> This breaks things downstream: in Nuxt, unimport's `scanDirExports` picks up `IAppMode` as a value export and type checking fails once more than one `imports.dirs` entry is configured.
> 
> Real comparisons such as `export const a = 1<2, b = 3` must still give `["a", "b"]`, and type annotations containing arrow function types, like `export const a: Map<string, (x: string) => void> = new Map(), b = 1`, should give `["a", "b"]` too.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [src/analyze.ts](../../tasks/ts-mlly-generic-export-names/upstream/src/analyze.ts), [test/exports.test.ts](../../tasks/ts-mlly-generic-export-names/upstream/test/exports.test.ts)

```diff
diff --git a/src/analyze.ts b/src/analyze.ts
index 52caecb..2ceb507 100644
--- a/src/analyze.ts
+++ b/src/analyze.ts
@@ -436,11 +436,22 @@ function _extractExtraNames(extraNamesStr: string): string[] {
     ) {
       inTypeAnnotation = false;
     }
+    // Track angle brackets for generics (`Map<T>` vs comparison `x < y`)
     if (inTypeAnnotation && char === "<") {
       angleDepth++;
       continue;
     }
-    if (inTypeAnnotation && char === ">" && angleDepth > 0) {
+    if (
+      !inTypeAnnotation &&
+      char === "<" &&
+      depth === 0 &&
+      i > 0 &&
+      _isIdentifierBeforeAngleBracket(extraNamesStr, i)
+    ) {
+      angleDepth++;
+      continue;
+    }
+    if (char === ">" && angleDepth > 0 && extraNamesStr[i - 1] !== "=") {
       angleDepth--;
       continue;
     }
@@ -764,3 +775,18 @@ function _getLocations(code: string, label: string) {
   }
   return locations;
 }
+
+/**
+ * Check if `<` at position `i` is preceded by an identifier (not a bare number).
+ * `Map2<T>` → true (identifier ends with digit), `1<2` → false (bare number).
+ */
+function _isIdentifierBeforeAngleBracket(str: string, i: number): boolean {
+  let j = i - 1;
+  // Walk back over identifier characters [A-Za-z0-9_$]
+  while (j >= 0 && /[A-Za-z0-9_$]/.test(str[j])) {
+    j--;
+  }
+  // Must have consumed at least one char, and the first char of the word must be a letter/underscore/$
+  const wordStart = j + 1;
+  return wordStart < i && /[A-Za-z_$]/.test(str[wordStart]);
+}
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +41/-2 | 25 | 4,109 | $0.135 |
| claude | muffle | **FAIL** | +64/-2 | 25 | 8,489 | $0.258 |
| claude | hush | pass | +49/-5 | 0 | 3,511 | $0.114 |
| claude | sloth | **FAIL** | +15/-5 | 0 | 10,356 | $0.261 |
| claude | all | pass | +56/-3 | 0 | 4,780 | $0.136 |
| codex | base | pass | +43/-4 | 24 | 1,787 | - |
| codex | muffle | pass | +46/-4 | 27 | 2,692 | - |
| codex | hush | pass | +69/-4 | 24 | 1,876 | - |
| codex | sloth | pass | +31/-9 | 0 | 2,907 | - |
| codex | all | pass | +31/-4 | 0 | 1,598 | - |

### claude, base: pass

Files: [src/analyze.ts](../base/claude/ts-mlly-generic-export-names-1/files/src/analyze.ts), [test/exports.test.ts](../base/claude/ts-mlly-generic-export-names-1/files/test/exports.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/analyze.ts b/src/analyze.ts
index 52caecb..561c36a 100644
--- a/src/analyze.ts
+++ b/src/analyze.ts
@@ -259,7 +259,7 @@ const IMPORT_NAMED_TYPE_RE =
  * @example `export const num = 1, str = 'hello'; export class Example {}`
  */
 export const EXPORT_DECAL_RE =
-  /\bexport\s+(?<declaration>(?:async function\s*\*?|function\s*\*?|let|const enum|const|enum|var|class))\s+\*?(?<name>[\w$]+)(?<extraNames>.*,\s*[\s\w:[\]{}]*[\w$\]}]+)*/g;
+  /\bexport\s+(?<declaration>(?:async function\s*\*?|function\s*\*?|let|const enum|const|enum|var|class))\s+\*?(?<name>[\w$]+)(?<extraNames>.*,.*)?/g;
 /**
  * Regular expression to match export declarations specifically for types, interfaces, and type aliases in TypeScript.
  * @example `export type Result = { success: boolean; }; export interface User { name: string; age: number; };`
@@ -386,6 +386,31 @@ export function parseTypeImport(
   } as ParsedStaticImport;
 }
 
+/**
+ * If the `<` at `start` opens generic type arguments of a call (`foo<A, B>(`),
+ * returns the index of the matching `>`, otherwise -1 (e.g. a comparison `1<2`).
+ */
+function _findGenericCallEnd(str: string, start: number): number {
+  if (!/[\w$]/.test(str[start - 1] || "")) {
+    return -1;
+  }
+  let depth = 0;
+  for (let i = start; i < str.length; i++) {
+    const char = str[i];
+    if (char === "<") {
+      depth++;
+    } else if (char === ">" && str[i - 1] !== "=") {
+      depth--;
+      if (depth === 0) {
+        return /^\s*\(/.test(str.slice(i + 1)) ? i : -1;
+      }
+    } else if (!/[\w$\s,.[\]{}()|&:?'"`=;*-]/.test(char)) {
+      return -1;
+    }
+  }
+  return -1;
+}
+
 /**
  * Extracts extra variable names from a comma-separated declaration list,
  * ignoring commas nested inside parentheses, brackets, braces, generics, or strings.
@@ -440,11 +465,25 @@ function _extractExtraNames(extraNamesStr: string): string[] {
       angleDepth++;
       continue;
     }
-    if (inTypeAnnotation && char === ">" && angleDepth > 0) {
+    if (
+      inTypeAnnotation &&
+      char === ">" &&
+      angleDepth > 0 &&
+      extraNamesStr[i - 1] !== "="
+    ) {
       angleDepth--;
       continue;
     }
 
+    // Skip generic type arguments of calls/constructors, e.g. `new Map<string, T>()`
+    if (char === "<" && depth === 0 && angleDepth === 0) {
+      const end = _findGenericCallEnd(extraNamesStr, i);
+      if (end > i) {
+        i = end;
+        continue;
+      }
+    }
+
     // Track bracket nesting
     if (char === "(" || char === "[" || char === "{") {
       depth++;
diff --git a/test/exports.test.ts b/test/exports.test.ts
index baf98d7..14bacd1 100644
--- a/test/exports.test.ts
+++ b/test/exports.test.ts
@@ -597,3 +597,28 @@ describe("findTypeExports", () => {
     `);
   });
 });
+
+describe("findExports generics", () => {
+  const names = (code: string) => findExports(code).flatMap((e) => e.names);
+
+  it("ignores generic type arguments", () => {
+    expect(
+      names("export const APP_MODE_MAP = new Map<string, IAppMode>()"),
+    ).toEqual(["APP_MODE_MAP"]);
+    expect(names("export const result = foo<Bar, Baz>(arg1, arg2)")).toEqual([
+      "result",
+    ]);
+    expect(
+      names("export const a = new Set<string>(), b = new Map<string, number>()"),
+    ).toEqual(["a", "b"]);
+  });
+
+  it("keeps comparisons and arrow types working", () => {
+    expect(names("export const a = 1<2, b = 3")).toEqual(["a", "b"]);
+    expect(
+      names(
+        "export const a: Map<string, (x: string) => void> = new Map(), b = 1",
+      ),
+    ).toEqual(["a", "b"]);
+  });
+});
```

</details>

<details><summary>reply</summary>

Adding a regression test for the fix, then I'll run the suite.

`findExports` no longer reports generic type arguments as export names. The full suite passes, including the new regression tests.

The fix is in `src/analyze.ts`, in two parts:
- **Capture regex:** the `extraNames` group in `EXPORT_DECAL_RE` stopped at the last comma-separated identifier and dropped the closing `>()`. That left the parser nothing to tell it a `<` opened generics. It now captures the rest of the line.
- **Generic calls:** `_extractExtraNames` now skips `<...>` after an identifier when the matching `>` is followed by `(`, as in `new Map<string, X>()` or `foo<A, B>(x)`. A comparison like `1<2, b = 3` has no such `>`, so it's still treated as a comparison.
- **Arrow types:** a `=>` inside a type annotation was being counted as the end of a generic. That broke `Map<string, (x: string) => void>`, and it's fixed.

All five examples from your report now give the expected names. The tests are in a new `findExports generics` block in `test/exports.test.ts`.

Something like `a<b, c>(d)` is ambiguous between a comparison and a generic call. It's treated as a generic call, which is how TypeScript reads it.

I haven't committed anything.

</details>

### claude, muffle: FAIL

Files: [src/analyze.ts](../muffle/claude/ts-mlly-generic-export-names-1/files/src/analyze.ts), [test/exports.test.ts](../muffle/claude/ts-mlly-generic-export-names-1/files/test/exports.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/analyze.ts b/src/analyze.ts
index 52caecb..fba97a5 100644
--- a/src/analyze.ts
+++ b/src/analyze.ts
@@ -386,6 +386,30 @@ export function parseTypeImport(
   } as ParsedStaticImport;
 }
 
+/**
+ * Returns the index of the `>` closing the generic argument list opened at `start`
+ * if it is followed by `(` and contains only type-like characters, otherwise -1.
+ */
+function _findGenericEnd(str: string, start: number): number {
+  let level = 0;
+  for (let i = start; i < str.length; i++) {
+    const char = str[i];
+    if (char === "<") {
+      level++;
+    } else if (char === ">") {
+      if (str[i - 1] === "=") {
+        continue;
+      }
+      if (--level === 0) {
+        return /^\s*\(/.test(str.slice(i + 1)) ? i : -1;
+      }
+    } else if (!/[\w$\s,.[\]|&?:{}()='";*-]/.test(char)) {
+      return -1;
+    }
+  }
+  return -1;
+}
+
 /**
  * Extracts extra variable names from a comma-separated declaration list,
  * ignoring commas nested inside parentheses, brackets, braces, generics, or strings.
@@ -440,11 +464,32 @@ function _extractExtraNames(extraNamesStr: string): string[] {
       angleDepth++;
       continue;
     }
-    if (inTypeAnnotation && char === ">" && angleDepth > 0) {
+    if (
+      inTypeAnnotation &&
+      char === ">" &&
+      extraNamesStr[i - 1] !== "=" &&
+      angleDepth > 0
+    ) {
       angleDepth--;
       continue;
     }
 
+    // Generic call/instantiation in an expression, e.g. `new Map<string, A>()` or `fn<A, B>(x)`.
+    // Only treated as generics when the matching `>` is directly followed by `(`;
+    // otherwise (e.g. `1<2, b = 3`) it is a comparison.
+    if (
+      !inTypeAnnotation &&
+      char === "<" &&
+      depth >= 0 &&
+      /[A-Za-z_$]/.test(extraNamesStr[i - 1] || "")
+    ) {
+      const end = _findGenericEnd(extraNamesStr, i);
+      if (end > 0) {
+        i = end;
+        continue;
+      }
+    }
+
     // Track bracket nesting
     if (char === "(" || char === "[" || char === "{") {
       depth++;
@@ -452,6 +497,11 @@ function _extractExtraNames(extraNamesStr: string): string[] {
       depth--;
     }
 
+    // A statement terminator ends the declaration list
+    if (char === ";" && depth === 0 && angleDepth === 0) {
+      break;
+    }
+
     // A comma at depth 0 (outside generics) is a real declaration separator
     if (char === "," && depth === 0 && angleDepth === 0) {
       // Extract the identifier that follows this comma
@@ -488,7 +538,19 @@ export function findExports(code: string): ESMExport[] {
       | string
       | undefined;
     if (extraNamesStr) {
-      const extraNames = _extractExtraNames(extraNamesStr);
+      // The regex capture ends at the last identifier after a comma, which cuts
+      // generic calls like `new Map<A, B>()` short, so scan the rest of the line.
+      const nameEnd =
+        declaredExport.start +
+        declaredExport.code.indexOf(
+          declaredExport.name,
+          "export".length + declaredExport.declaration.length,
+        ) +
+        declaredExport.name.length;
+      const lineEnd = code.indexOf("\n", nameEnd);
+      const extraNames = _extractExtraNames(
+        code.slice(nameEnd, lineEnd === -1 ? undefined : lineEnd),
+      );
       if (extraNames.length > 0) {
         declaredExport.names = [declaredExport.name, ...extraNames];
       }
diff --git a/test/exports.test.ts b/test/exports.test.ts
index baf98d7..e349ba3 100644
--- a/test/exports.test.ts
+++ b/test/exports.test.ts
@@ -319,6 +319,31 @@ export { type AType, type B as BType, foo } from 'foo'
   });
 });
 
+describe("findExports generics", () => {
+  const names = (code: string) => findExports(code).map((e) => e.names);
+  it("ignores commas in generic type arguments", () => {
+    expect(
+      names("export const APP_MODE_MAP = new Map<string, IAppMode>()"),
+    ).toEqual([["APP_MODE_MAP"]]);
+    expect(names("export const result = foo<Bar, Baz>(arg1, arg2)")).toEqual([
+      ["result"],
+    ]);
+    expect(
+      names(
+        "export const a = new Set<string>(), b = new Map<string, number>()",
+      ),
+    ).toEqual([["a", "b"]]);
+  });
+  it("still handles comparisons and arrow types", () => {
+    expect(names("export const a = 1<2, b = 3")).toEqual([["a", "b"]]);
+    expect(
+      names(
+        "export const a: Map<string, (x: string) => void> = new Map(), b = 1",
+      ),
+    ).toEqual([["a", "b"]]);
+  });
+});
+
 describe("findExportNames", () => {
   it("findExportNames", () => {
     expect(
```

</details>

<details><summary>reply</summary>

You've hit your session limit · resets 11:30am (Europe/Stockholm)

Fix works and tsc is clean; I'm now adding permanent regression tests and running lint.

`findExports` no longer reports generic type arguments as export names. All the cases from your report now give the expected names.

The full suite passes (191 tests), and eslint and `tsc --noEmit` are clean.

There were two causes, both in `src/analyze.ts`:
- **Truncated capture:** the regex capture of the declaration tail stopped at the last identifier after a comma. For `new Map<string, IAppMode>()` that left `IAppMode` as the last thing seen, with no `>()` after it. I now scan the rest of the line from the end of the first name, and the scan stops at a top-level `;`.
- **Generics in expressions:** the scanner only tracked `<` and `>` inside type annotations. It now also treats `<…>` as generic arguments when the matching `>` is followed by `(`, as in `new Set<string>()` or `foo<Bar, Baz>(…)`. `export const a = 1<2, b = 3` still counts as a comparison and gives `["a", "b"]`.
- **Arrow types:** the `>` in `=>` no longer closes an angle bracket. `export const a: Map<string, (x: string) => void> = new Map(), b = 1` gives `["a", "b"]`.

I added regression tests for all five cases in `test/exports.test.ts`. I didn't commit anything.

The generic-call rule can misread `a<b, c>(d)` written as a comparison chain. That's the same ambiguity TypeScript resolves as a generic call, so I left it.

</details>

### claude, hush: pass

Files: [src/analyze.ts](../hush/claude/ts-mlly-generic-export-names-1/files/src/analyze.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/analyze.ts b/src/analyze.ts
index 52caecb..3b1c1f3 100644
--- a/src/analyze.ts
+++ b/src/analyze.ts
@@ -386,6 +386,29 @@ export function parseTypeImport(
   } as ParsedStaticImport;
 }
 
+/**
+ * Finds the `>` closing the generic type arguments opened at `start`, only if
+ * followed by `(`, so comparisons like `1<2, b = 3` are not mistaken for generics.
+ * @returns {number} Index of the closing `>`, or -1.
+ */
+function _findGenericEnd(str: string, start: number): number {
+  let level = 0;
+  for (let i = start; i < str.length; i++) {
+    const char = str[i];
+    if (char === "<") {
+      level++;
+    } else if (char === ">" && str[i - 1] !== "=") {
+      level--;
+      if (level === 0) {
+        return /^\s*\(/.test(str.slice(i + 1)) ? i : -1;
+      }
+    } else if (!/[\w$\s,.|&[\]{}()?:=;'"`-]/.test(char)) {
+      return -1;
+    }
+  }
+  return -1;
+}
+
 /**
  * Extracts extra variable names from a comma-separated declaration list,
  * ignoring commas nested inside parentheses, brackets, braces, generics, or strings.
@@ -440,11 +463,29 @@ function _extractExtraNames(extraNamesStr: string): string[] {
       angleDepth++;
       continue;
     }
-    if (inTypeAnnotation && char === ">" && angleDepth > 0) {
+    if (
+      inTypeAnnotation &&
+      char === ">" &&
+      angleDepth > 0 &&
+      extraNamesStr[i - 1] !== "="
+    ) {
       angleDepth--;
       continue;
     }
 
+    // Generic call/instantiation in expression: `foo<A, B>(...)`, skip type args
+    if (
+      char === "<" &&
+      !inTypeAnnotation &&
+      /[\w$]/.test(extraNamesStr[i - 1] || "")
+    ) {
+      const end = _findGenericEnd(extraNamesStr, i);
+      if (end > 0) {
+        i = end;
+        continue;
+      }
+    }
+
     // Track bracket nesting
     if (char === "(" || char === "[" || char === "{") {
       depth++;
@@ -484,10 +525,13 @@ export function findExports(code: string): ESMExport[] {
     if (/^export\s+(?:async\s+)?function/.test(declaredExport.code)) {
       continue;
     }
-    const extraNamesStr = (declaredExport as any).extraNames as
-      | string
-      | undefined;
-    if (extraNamesStr) {
+    const captured = (declaredExport as any).extraNames as string | undefined;
+    if (captured) {
+      // The regex capture may stop mid-generic (`Map<string, A>()`), so
+      // extend it to the end of the line for the scanner.
+      const from = declaredExport.end - captured.length;
+      const eol = code.indexOf("\n", declaredExport.end);
+      const extraNamesStr = code.slice(from, eol === -1 ? undefined : eol);
       const extraNames = _extractExtraNames(extraNamesStr);
       if (extraNames.length > 0) {
         declaredExport.names = [declaredExport.name, ...extraNames];
```

</details>

<details><summary>reply</summary>

Done. `src/analyze.ts` now skips generic type args in expressions and handles `=>` inside annotations. All 5 cases from your report pass, along with the existing 185 tests. I ran the 5 cases as a throwaway test and deleted it, so no regression test is committed. Not committed.

</details>

### claude, sloth: FAIL

Files: [src/analyze.ts](../sloth/claude/ts-mlly-generic-export-names-1/files/src/analyze.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/analyze.ts b/src/analyze.ts
index 52caecb..0a32f43 100644
--- a/src/analyze.ts
+++ b/src/analyze.ts
@@ -259,7 +259,7 @@ const IMPORT_NAMED_TYPE_RE =
  * @example `export const num = 1, str = 'hello'; export class Example {}`
  */
 export const EXPORT_DECAL_RE =
-  /\bexport\s+(?<declaration>(?:async function\s*\*?|function\s*\*?|let|const enum|const|enum|var|class))\s+\*?(?<name>[\w$]+)(?<extraNames>.*,\s*[\s\w:[\]{}]*[\w$\]}]+)*/g;
+  /\bexport\s+(?<declaration>(?:async function\s*\*?|function\s*\*?|let|const enum|const|enum|var|class))\s+\*?(?<name>[\w$]+)(?<extraNames>.*,\s*[\s\w:[\]{}]*[\w$\]}]+)*(?=(?<extraTail>.*))/g;
 /**
  * Regular expression to match export declarations specifically for types, interfaces, and type aliases in TypeScript.
  * @example `export type Result = { success: boolean; }; export interface User { name: string; age: number; };`
@@ -445,6 +445,17 @@ function _extractExtraNames(extraNamesStr: string): string[] {
       continue;
     }
 
+    // Skip generic type arguments of calls like `new Map<string, X>()`
+    if (char === "<" && !inTypeAnnotation) {
+      const generic = extraNamesStr
+        .slice(i)
+        .match(/^<[\w$\s,.[\]|&<>?:'"{}]*?>(?=\s*\()/);
+      if (generic) {
+        i += generic[0].length - 1;
+        continue;
+      }
+    }
+
     // Track bracket nesting
     if (char === "(" || char === "[" || char === "{") {
       depth++;
@@ -484,16 +495,15 @@ export function findExports(code: string): ESMExport[] {
     if (/^export\s+(?:async\s+)?function/.test(declaredExport.code)) {
       continue;
     }
-    const extraNamesStr = (declaredExport as any).extraNames as
-      | string
-      | undefined;
+    const { extraNames: extraNamesStr, extraTail } = declaredExport as any;
     if (extraNamesStr) {
-      const extraNames = _extractExtraNames(extraNamesStr);
+      const extraNames = _extractExtraNames(extraNamesStr + extraTail);
       if (extraNames.length > 0) {
         declaredExport.names = [declaredExport.name, ...extraNames];
       }
     }
     delete (declaredExport as any).extraNames;
+    delete (declaredExport as any).extraTail;
   }
 
   // Find named exports
```

</details>

<details><summary>reply</summary>

Output is empty, so I'll re-run with a timeout and put the scratch test back.

`findExports` no longer reports generic type arguments as export names. All five cases from your report give the expected names, and `tsc` and `eslint` are clean. I checked the cases with a throwaway test and deleted it afterwards, so no new tests were added to the suite. The existing suite still passes (190 tests).

The fix is in `src/analyze.ts` and has two parts:
- **Truncated capture:** The export regex stopped its captured text at the last identifier after a comma. For `new Map<string, IAppMode>()` the capture ended at `IAppMode` and lost the closing `>(`. I added a lookahead group, `extraTail`, that carries the rest of the line, and `findExports` appends it before calling `_extractExtraNames`.
- **Generics in expressions:** `_extractExtraNames` only handled `<…>` inside type annotations. It now also skips a `<…>` that is followed by `(`, so `new Set<string>()` and `foo<Bar, Baz>(…)` are handled.

Comparisons like `1<2, b = 3` don't match that pattern, so they still give `["a", "b"]`. The annotation case with an arrow function type already worked once the capture was fixed.

Expression-level generics whose arguments contain parentheses, such as `new Map<string, (x: string) => void>()`, are still not recognised. Without the parentheses the skip pattern stays tight, which keeps comparisons safe. Type annotations with arrow types are fine.

I made no commit.

That notification is about my first test attempt. That run hung in vitest's default watch mode and was killed at its time limit. I had already re-run the check with `--no-watch`, which is the run I reported, and I don't need to restart the old one.

The fix and results in my last message stand. The scratch test file is deleted, and `git status` showed only `src/analyze.ts` modified. I made no commit.

</details>

### claude, all: pass

Files: [src/analyze.ts](../all/claude/ts-mlly-generic-export-names-1/files/src/analyze.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/analyze.ts b/src/analyze.ts
index 52caecb..31d9a74 100644
--- a/src/analyze.ts
+++ b/src/analyze.ts
@@ -386,6 +386,33 @@ export function parseTypeImport(
   } as ParsedStaticImport;
 }
 
+/**
+ * Finds the end of generic type arguments of a call such as `foo<A, B>(x)`.
+ * Comparisons like `1<2, b = 3` have no closing `>` followed by `(`, so they are not matched.
+ * @param {string} str - The declaration list.
+ * @param {number} start - Index of the opening `<`.
+ * @returns {number} Index of the closing `>`, or -1 if this is not a generic call.
+ */
+function _findGenericCallEnd(str: string, start: number): number {
+  let angleDepth = 0;
+  for (let i = start; i < str.length; i++) {
+    const char = str[i];
+    if (char === "=" && str[i + 1] === ">") {
+      i++;
+    } else if (char === "<") {
+      angleDepth++;
+    } else if (char === ">") {
+      angleDepth--;
+      if (angleDepth === 0) {
+        return /^\s*\(/.test(str.slice(i + 1)) ? i : -1;
+      }
+    } else if (!/[\w$\s,.[\]|&?:'"(){};]/.test(char)) {
+      return -1;
+    }
+  }
+  return -1;
+}
+
 /**
  * Extracts extra variable names from a comma-separated declaration list,
  * ignoring commas nested inside parentheses, brackets, braces, generics, or strings.
@@ -393,9 +420,13 @@ export function parseTypeImport(
  * For `export const foo = fn('a', bar), baz = 2`, only `baz` should be
  * extracted — commas inside `fn(...)` or `Handler<A, B>` are not declaration separators.
  * @param {string} extraNamesStr - The string containing the extra variable declarations to parse.
+ * @param {number} matchedLength - Only separators before this index count; the rest is lookahead to close generics.
  * @returns {string[]} An array of variable names extracted from the declaration list.
  */
-function _extractExtraNames(extraNamesStr: string): string[] {
+function _extractExtraNames(
+  extraNamesStr: string,
+  matchedLength = extraNamesStr.length,
+): string[] {
   const names: string[] = [];
   let depth = 0;
   let angleDepth = 0;
@@ -436,10 +467,21 @@ function _extractExtraNames(extraNamesStr: string): string[] {
     ) {
       inTypeAnnotation = false;
     }
+    if (char === "=" && extraNamesStr[i + 1] === ">") {
+      i++;
+      continue;
+    }
     if (inTypeAnnotation && char === "<") {
       angleDepth++;
       continue;
     }
+    if (char === "<" && depth === 0) {
+      const end = _findGenericCallEnd(extraNamesStr, i);
+      if (end > 0) {
+        i = end;
+        continue;
+      }
+    }
     if (inTypeAnnotation && char === ">" && angleDepth > 0) {
       angleDepth--;
       continue;
@@ -453,7 +495,12 @@ function _extractExtraNames(extraNamesStr: string): string[] {
     }
 
     // A comma at depth 0 (outside generics) is a real declaration separator
-    if (char === "," && depth === 0 && angleDepth === 0) {
+    if (
+      char === "," &&
+      depth === 0 &&
+      angleDepth === 0 &&
+      i < matchedLength
+    ) {
       // Extract the identifier that follows this comma
       const rest = extraNamesStr.slice(i + 1);
       const match = rest.match(/^\s*([\w$]+)/);
@@ -488,7 +535,13 @@ export function findExports(code: string): ESMExport[] {
       | string
       | undefined;
     if (extraNamesStr) {
-      const extraNames = _extractExtraNames(extraNamesStr);
+      const lookahead = code
+        .slice(declaredExport.end)
+        .match(/^[^\n;]*/)![0];
+      const extraNames = _extractExtraNames(
+        extraNamesStr + lookahead,
+        extraNamesStr.length,
+      );
       if (extraNames.length > 0) {
         declaredExport.names = [declaredExport.name, ...extraNames];
       }
```

</details>

<details><summary>reply</summary>

Fixing: regex truncates the captured text before `>()`, so I'm passing a longer lookahead to the scanner.

Done. `src/analyze.ts` now skips generic type args in `_extractExtraNames`, with lookahead past the regex cut. All 5 cases pass, existing tests pass, `tsc` is clean. I added no permanent tests.

</details>

### codex, base: pass

Files: [src/analyze.ts](../base/codex/ts-mlly-generic-export-names-1/files/src/analyze.ts), [test/exports.test.ts](../base/codex/ts-mlly-generic-export-names-1/files/test/exports.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/analyze.ts b/src/analyze.ts
index 52caecb..f58840e 100644
--- a/src/analyze.ts
+++ b/src/analyze.ts
@@ -395,7 +395,10 @@ export function parseTypeImport(
  * @param {string} extraNamesStr - The string containing the extra variable declarations to parse.
  * @returns {string[]} An array of variable names extracted from the declaration list.
  */
-function _extractExtraNames(extraNamesStr: string): string[] {
+function _extractExtraNames(
+  extraNamesStr: string,
+  remainingCode: string,
+): string[] {
   const names: string[] = [];
   let depth = 0;
   let angleDepth = 0;
@@ -436,11 +439,14 @@ function _extractExtraNames(extraNamesStr: string): string[] {
     ) {
       inTypeAnnotation = false;
     }
-    if (inTypeAnnotation && char === "<") {
+    if (
+      char === "<" &&
+      (inTypeAnnotation || angleDepth > 0 || _isGenericCall(remainingCode, i))
+    ) {
       angleDepth++;
       continue;
     }
-    if (inTypeAnnotation && char === ">" && angleDepth > 0) {
+    if (char === ">" && extraNamesStr[i - 1] !== "=" && angleDepth > 0) {
       angleDepth--;
       continue;
     }
@@ -466,6 +472,36 @@ function _extractExtraNames(extraNamesStr: string): string[] {
   return names;
 }
 
+// Look for a balanced type argument list followed by a call. Use the full
+// source because the declaration regex may stop inside the type arguments.
+function _isGenericCall(code: string, start: number): boolean {
+  let depth = 0;
+  let quote = "";
+  for (let i = start; i < code.length; i++) {
+    const char = code[i];
+    if (quote) {
+      if (char === "\\") {
+        i++;
+      } else if (char === quote) {
+        quote = "";
+      }
+      continue;
+    }
+    if (char === '"' || char === "'" || char === "`") {
+      quote = char;
+    } else if (char === "<") {
+      depth++;
+    } else if (char === ">" && code[i - 1] !== "=") {
+      if (--depth === 0) {
+        return /^\s*\(/.test(code.slice(i + 1));
+      }
+    } else if (char === ";") {
+      return false;
+    }
+  }
+  return false;
+}
+
 /**
  * Identifies all export statements in the supplied source code and categorises them into different types such as declarations, named, default and star exports.
  * This function processes the code to capture different forms of export statements and normalise their representation for further processing.
@@ -488,7 +524,10 @@ export function findExports(code: string): ESMExport[] {
       | string
       | undefined;
     if (extraNamesStr) {
-      const extraNames = _extractExtraNames(extraNamesStr);
+      const extraNames = _extractExtraNames(
+        extraNamesStr,
+        code.slice(declaredExport.end - extraNamesStr.length),
+      );
       if (extraNames.length > 0) {
         declaredExport.names = [declaredExport.name, ...extraNames];
       }
diff --git a/test/exports.test.ts b/test/exports.test.ts
index baf98d7..f23983b 100644
--- a/test/exports.test.ts
+++ b/test/exports.test.ts
@@ -126,6 +126,30 @@ describe("findExports", () => {
       type: "declaration",
       names: ["a", "b"],
     },
+    "export const APP_MODE_MAP = new Map<string, IAppMode>()": {
+      type: "declaration",
+      names: ["APP_MODE_MAP"],
+    },
+    "export const result = foo<Bar, Baz>(arg1, arg2)": {
+      type: "declaration",
+      names: ["result"],
+    },
+    "export const a = new Set<string>(), b = new Map<string, number>()": {
+      type: "declaration",
+      names: ["a", "b"],
+    },
+    "export const a = 1<2, b = 3": {
+      type: "declaration",
+      names: ["a", "b"],
+    },
+    "export const a: Map<string, (x: string) => void> = new Map(), b = 1": {
+      type: "declaration",
+      names: ["a", "b"],
+    },
+    "export const a = foo<Map<string, number>, (x: string) => void>(), b = 1": {
+      type: "declaration",
+      names: ["a", "b"],
+    },
     "export const foo: Handler<string, number> = function foo(){}": {
       type: "declaration",
       name: "foo",
```

</details>

<details><summary>reply</summary>

I’ll check how `findExports` splits declarations, fix generic argument handling, and add regression tests for the cases you listed.

The scanner already tracks generic brackets in type annotations, but not in initializers. It also treats the `>` in `=>` as a closing generic bracket. I’ll fix both and use lookahead to distinguish generic calls from comparisons such as `1<2`.

Fixed `findExports` to recognize generic constructor and call arguments while preserving real comparison separators. Arrow function types no longer close generic brackets prematurely.

Added regression tests for your examples and nested generics.

Validation passed: all 195 tests, lint, formatting, and TypeScript checks.

</details>

### codex, muffle: pass

Files: [src/analyze.ts](../muffle/codex/ts-mlly-generic-export-names-1/files/src/analyze.ts), [test/exports.test.ts](../muffle/codex/ts-mlly-generic-export-names-1/files/test/exports.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/analyze.ts b/src/analyze.ts
index 52caecb..bc03df8 100644
--- a/src/analyze.ts
+++ b/src/analyze.ts
@@ -393,10 +393,15 @@ export function parseTypeImport(
  * For `export const foo = fn('a', bar), baz = 2`, only `baz` should be
  * extracted — commas inside `fn(...)` or `Handler<A, B>` are not declaration separators.
  * @param {string} extraNamesStr - The string containing the extra variable declarations to parse.
+ * @param {string} trailingCode - Code after the match, used to look ahead for closing generic brackets.
  * @returns {string[]} An array of variable names extracted from the declaration list.
  */
-function _extractExtraNames(extraNamesStr: string): string[] {
+function _extractExtraNames(
+  extraNamesStr: string,
+  trailingCode: string,
+): string[] {
   const names: string[] = [];
+  const code = extraNamesStr + trailingCode;
   let depth = 0;
   let angleDepth = 0;
   let inString: string | false = false;
@@ -436,11 +441,14 @@ function _extractExtraNames(extraNamesStr: string): string[] {
     ) {
       inTypeAnnotation = false;
     }
-    if (inTypeAnnotation && char === "<") {
+    if (
+      char === "<" &&
+      (inTypeAnnotation || angleDepth > 0 || _isGenericCall(code, i))
+    ) {
       angleDepth++;
       continue;
     }
-    if (inTypeAnnotation && char === ">" && angleDepth > 0) {
+    if (char === ">" && extraNamesStr[i - 1] !== "=" && angleDepth > 0) {
       angleDepth--;
       continue;
     }
@@ -466,6 +474,37 @@ function _extractExtraNames(extraNamesStr: string): string[] {
   return names;
 }
 
+// In expressions, only treat `<` as a generic argument list when it has a
+// matching `>` followed by call arguments. An unmatched comparison such as
+// `1<2, b = 3` must not hide the next declaration.
+function _isGenericCall(code: string, start: number): boolean {
+  let depth = 0;
+  let quote = "";
+  for (let i = start; i < code.length; i++) {
+    const char = code[i];
+    if (quote) {
+      if (char === "\\") {
+        i++;
+      } else if (char === quote) {
+        quote = "";
+      }
+      continue;
+    }
+    if (char === '"' || char === "'" || char === "`") {
+      quote = char;
+    } else if (char === "<") {
+      depth++;
+    } else if (char === ">" && code[i - 1] !== "=") {
+      if (--depth === 0) {
+        return /^\s*\(/.test(code.slice(i + 1));
+      }
+    } else if (char === ";" || (char === "=" && code[i + 1] !== ">")) {
+      return false;
+    }
+  }
+  return false;
+}
+
 /**
  * Identifies all export statements in the supplied source code and categorises them into different types such as declarations, named, default and star exports.
  * This function processes the code to capture different forms of export statements and normalise their representation for further processing.
@@ -488,7 +527,10 @@ export function findExports(code: string): ESMExport[] {
       | string
       | undefined;
     if (extraNamesStr) {
-      const extraNames = _extractExtraNames(extraNamesStr);
+      const extraNames = _extractExtraNames(
+        extraNamesStr,
+        code.slice(declaredExport.end),
+      );
       if (extraNames.length > 0) {
         declaredExport.names = [declaredExport.name, ...extraNames];
       }
diff --git a/test/exports.test.ts b/test/exports.test.ts
index baf98d7..d8463b5 100644
--- a/test/exports.test.ts
+++ b/test/exports.test.ts
@@ -145,6 +145,33 @@ describe("findExports", () => {
       name: "foo",
       names: ["foo"],
     },
+    "export const APP_MODE_MAP = new Map<string, IAppMode>()": {
+      names: ["APP_MODE_MAP"],
+    },
+    "export const result = foo<Bar, Baz>(arg1, arg2)": {
+      names: ["result"],
+    },
+    "export const a = new Set<string>(), b = new Map<string, number>()": {
+      names: ["a", "b"],
+    },
+    "export const a = new Map<string, Map<number, boolean>>(), b = 1": {
+      names: ["a", "b"],
+    },
+    "export const a = foo<string, (x: string) => void>(), b = 1": {
+      names: ["a", "b"],
+    },
+    "export const a: Map<string, (x: string) => void> = new Map(), b = 1": {
+      names: ["a", "b"],
+    },
+    "export const a = 1<2, b = 3": {
+      names: ["a", "b"],
+    },
+    "export const a = 1 < 2, b = foo<Bar, Baz>()": {
+      names: ["a", "b"],
+    },
+    "export const a = 2 > 1, b = 3": {
+      names: ["a", "b"],
+    },
   };
 
   for (const [input, test] of Object.entries(tests)) {
```

</details>

<details><summary>reply</summary>

I’ll check how `findExports` splits declarations, fix generic argument handling, and add regression tests for these cases.

The declaration regex also truncates some matches before the closing `>`, so the scanner needs to look past the captured text to recognize a generic call. I’ll add that lookahead while preserving comparison handling. Arrow function types also need a guard so `=>` doesn’t close a generic list.

Fixed `findExports` to ignore commas inside generic constructor and call arguments, preserve real declaration separators, and handle `=>` inside generic type annotations.

Added regression tests for all reported cases and nested generics.

Validation passed: all 198 tests, ESLint, Prettier, and TypeScript checks.

</details>

### codex, hush: pass

Files: [src/analyze.ts](../hush/codex/ts-mlly-generic-export-names-1/files/src/analyze.ts), [test/exports.test.ts](../hush/codex/ts-mlly-generic-export-names-1/files/test/exports.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/analyze.ts b/src/analyze.ts
index 52caecb..19a80ad 100644
--- a/src/analyze.ts
+++ b/src/analyze.ts
@@ -386,6 +386,61 @@ export function parseTypeImport(
   } as ParsedStaticImport;
 }
 
+/** Checks whether an initializer's angle brackets introduce a generic call. */
+function _isGenericCall(source: string): boolean {
+  let angleDepth = 0;
+  let depth = 0;
+  let quote = "";
+  for (let i = 0; i < source.length; i++) {
+    const char = source[i];
+    if (quote) {
+      if (char === "\\") {
+        i++;
+      } else if (char === quote) {
+        quote = "";
+      }
+      continue;
+    }
+    switch (char) {
+      case '"':
+      case "'":
+      case "`": {
+        quote = char;
+
+        break;
+      }
+      case "(":
+      case "[":
+      case "{": {
+        depth++;
+
+        break;
+      }
+      case ")":
+      case "]":
+      case "}": {
+        if (--depth < 0) {
+          return false;
+        }
+
+        break;
+      }
+      default: {
+        if (depth === 0 && char === "<") {
+          angleDepth++;
+        } else if (depth === 0 && char === ">" && source[i - 1] !== "=") {
+          if (--angleDepth === 0) {
+            return /^\s*\(/.test(source.slice(i + 1));
+          }
+        } else if (char === ";") {
+          return false;
+        }
+      }
+    }
+  }
+  return false;
+}
+
 /**
  * Extracts extra variable names from a comma-separated declaration list,
  * ignoring commas nested inside parentheses, brackets, braces, generics, or strings.
@@ -395,7 +450,7 @@ export function parseTypeImport(
  * @param {string} extraNamesStr - The string containing the extra variable declarations to parse.
  * @returns {string[]} An array of variable names extracted from the declaration list.
  */
-function _extractExtraNames(extraNamesStr: string): string[] {
+function _extractExtraNames(extraNamesStr: string, source: string): string[] {
   const names: string[] = [];
   let depth = 0;
   let angleDepth = 0;
@@ -436,11 +491,14 @@ function _extractExtraNames(extraNamesStr: string): string[] {
     ) {
       inTypeAnnotation = false;
     }
-    if (inTypeAnnotation && char === "<") {
+    if (
+      char === "<" &&
+      (inTypeAnnotation || angleDepth > 0 || _isGenericCall(source.slice(i)))
+    ) {
       angleDepth++;
       continue;
     }
-    if (inTypeAnnotation && char === ">" && angleDepth > 0) {
+    if (char === ">" && extraNamesStr[i - 1] !== "=" && angleDepth > 0) {
       angleDepth--;
       continue;
     }
@@ -488,7 +546,14 @@ export function findExports(code: string): ESMExport[] {
       | string
       | undefined;
     if (extraNamesStr) {
-      const extraNames = _extractExtraNames(extraNamesStr);
+      const extraNames = _extractExtraNames(
+        extraNamesStr,
+        code.slice(
+          declaredExport.start +
+            declaredExport.code.length -
+            extraNamesStr.length,
+        ),
+      );
       if (extraNames.length > 0) {
         declaredExport.names = [declaredExport.name, ...extraNames];
       }
diff --git a/test/exports.test.ts b/test/exports.test.ts
index baf98d7..f23983b 100644
--- a/test/exports.test.ts
+++ b/test/exports.test.ts
@@ -126,6 +126,30 @@ describe("findExports", () => {
       type: "declaration",
       names: ["a", "b"],
     },
+    "export const APP_MODE_MAP = new Map<string, IAppMode>()": {
+      type: "declaration",
+      names: ["APP_MODE_MAP"],
+    },
+    "export const result = foo<Bar, Baz>(arg1, arg2)": {
+      type: "declaration",
+      names: ["result"],
+    },
+    "export const a = new Set<string>(), b = new Map<string, number>()": {
+      type: "declaration",
+      names: ["a", "b"],
+    },
+    "export const a = 1<2, b = 3": {
+      type: "declaration",
+      names: ["a", "b"],
+    },
+    "export const a: Map<string, (x: string) => void> = new Map(), b = 1": {
+      type: "declaration",
+      names: ["a", "b"],
+    },
+    "export const a = foo<Map<string, number>, (x: string) => void>(), b = 1": {
+      type: "declaration",
+      names: ["a", "b"],
+    },
     "export const foo: Handler<string, number> = function foo(){}": {
       type: "declaration",
       name: "foo",
```

</details>

<details><summary>reply</summary>

Done.
`findExports` handles generic calls, comparisons, multiple declarators, arrow types. Added regression tests. All 195 tests, lint, type checks pass.

</details>

### codex, sloth: pass

Files: [src/analyze.ts](../sloth/codex/ts-mlly-generic-export-names-1/files/src/analyze.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/analyze.ts b/src/analyze.ts
index 52caecb..7b420b5 100644
--- a/src/analyze.ts
+++ b/src/analyze.ts
@@ -393,9 +393,13 @@ export function parseTypeImport(
  * For `export const foo = fn('a', bar), baz = 2`, only `baz` should be
  * extracted — commas inside `fn(...)` or `Handler<A, B>` are not declaration separators.
  * @param {string} extraNamesStr - The string containing the extra variable declarations to parse.
+ * @param {string} remainingCode - The source starting at the same position, including trailing call syntax.
  * @returns {string[]} An array of variable names extracted from the declaration list.
  */
-function _extractExtraNames(extraNamesStr: string): string[] {
+function _extractExtraNames(
+  extraNamesStr: string,
+  remainingCode: string,
+): string[] {
   const names: string[] = [];
   let depth = 0;
   let angleDepth = 0;
@@ -405,7 +409,6 @@ function _extractExtraNames(extraNamesStr: string): string[] {
   for (let i = 0; i < extraNamesStr.length; i++) {
     const char = extraNamesStr[i];
 
-    // Handle string literals — skip their contents entirely
     if (inString) {
       if (char === inString) {
         let backslashCount = 0;
@@ -423,7 +426,6 @@ function _extractExtraNames(extraNamesStr: string): string[] {
       continue;
     }
 
-    // Track type annotations (between `:` and `=` at depth 0) for generic angle brackets
     if (char === ":" && depth === 0 && angleDepth === 0) {
       inTypeAnnotation = true;
       continue;
@@ -436,25 +438,25 @@ function _extractExtraNames(extraNamesStr: string): string[] {
     ) {
       inTypeAnnotation = false;
     }
-    if (inTypeAnnotation && char === "<") {
+    if (
+      char === "<" &&
+      (inTypeAnnotation || angleDepth > 0 || _isGenericCall(remainingCode, i))
+    ) {
       angleDepth++;
       continue;
     }
-    if (inTypeAnnotation && char === ">" && angleDepth > 0) {
+    if (char === ">" && extraNamesStr[i - 1] !== "=" && angleDepth > 0) {
       angleDepth--;
       continue;
     }
 
-    // Track bracket nesting
     if (char === "(" || char === "[" || char === "{") {
       depth++;
     } else if (char === ")" || char === "]" || char === "}") {
       depth--;
     }
 
-    // A comma at depth 0 (outside generics) is a real declaration separator
     if (char === "," && depth === 0 && angleDepth === 0) {
-      // Extract the identifier that follows this comma
       const rest = extraNamesStr.slice(i + 1);
       const match = rest.match(/^\s*([\w$]+)/);
       if (match) {
@@ -466,6 +468,23 @@ function _extractExtraNames(extraNamesStr: string): string[] {
   return names;
 }
 
+/** Checks whether an opening angle bracket starts type arguments for a call. */
+function _isGenericCall(code: string, start: number): boolean {
+  let depth = 0;
+  for (let i = start; i < code.length; i++) {
+    if (code[i] === "<") {
+      depth++;
+    } else if (code[i] === ">" && code[i - 1] !== "=") {
+      if (--depth === 0) {
+        return /^\s*\(/.test(code.slice(i + 1));
+      }
+    } else if (code[i] === ";") {
+      return false;
+    }
+  }
+  return false;
+}
+
 /**
  * Identifies all export statements in the supplied source code and categorises them into different types such as declarations, named, default and star exports.
  * This function processes the code to capture different forms of export statements and normalise their representation for further processing.
@@ -488,7 +507,10 @@ export function findExports(code: string): ESMExport[] {
       | string
       | undefined;
     if (extraNamesStr) {
-      const extraNames = _extractExtraNames(extraNamesStr);
+      const extraNames = _extractExtraNames(
+        extraNamesStr,
+        code.slice(declaredExport.end - extraNamesStr.length),
+      );
       if (extraNames.length > 0) {
         declaredExport.names = [declaredExport.name, ...extraNames];
       }
```

</details>

<details><summary>reply</summary>

I’ll trace how `findExports` splits declarations, check its callers and existing coverage, then make the smallest fix and run the build and tests.

The shared declaration scanner only tracks `<…>` inside type annotations. It also treats the `>` in an arrow type as a closing bracket. I’ll fix both there so `findExports` and its callers inherit the correction. No public API, fixture, or config changes are needed.

The declaration regex stops before the closing `>` in some cases, so the scanner also needs the trailing source to recognize a generic call. With that adjustment, all your examples and a nested generic call check pass. I’m rerunning the build and existing checks.

Fixed in `src/analyze.ts`: generic call arguments no longer become export names, comparisons still split declarations correctly, and arrow function types preserve generic nesting.

Verified all supplied examples plus nested generics. Build, type checking, lint, and all 189 existing tests pass.

</details>

### codex, all: pass

Files: [src/analyze.ts](../all/codex/ts-mlly-generic-export-names-1/files/src/analyze.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/analyze.ts b/src/analyze.ts
index 52caecb..e979e2c 100644
--- a/src/analyze.ts
+++ b/src/analyze.ts
@@ -395,7 +395,10 @@ export function parseTypeImport(
  * @param {string} extraNamesStr - The string containing the extra variable declarations to parse.
  * @returns {string[]} An array of variable names extracted from the declaration list.
  */
-function _extractExtraNames(extraNamesStr: string): string[] {
+function _extractExtraNames(
+  extraNamesStr: string,
+  trailingCode: string,
+): string[] {
   const names: string[] = [];
   let depth = 0;
   let angleDepth = 0;
@@ -436,11 +439,14 @@ function _extractExtraNames(extraNamesStr: string): string[] {
     ) {
       inTypeAnnotation = false;
     }
-    if (inTypeAnnotation && char === "<") {
+    if (
+      char === "<" &&
+      (inTypeAnnotation || _hasTypeArguments(extraNamesStr + trailingCode, i))
+    ) {
       angleDepth++;
       continue;
     }
-    if (inTypeAnnotation && char === ">" && angleDepth > 0) {
+    if (char === ">" && extraNamesStr[i - 1] !== "=" && angleDepth > 0) {
       angleDepth--;
       continue;
     }
@@ -466,6 +472,24 @@ function _extractExtraNames(extraNamesStr: string): string[] {
   return names;
 }
 
+/** Checks whether an opening angle bracket starts type arguments for a call. */
+function _hasTypeArguments(code: string, start: number): boolean {
+  let depth = 1;
+  for (let i = start + 1; i < code.length; i++) {
+    const char = code[i];
+    if (char === "<") {
+      depth++;
+    } else if (char === ">" && code[i - 1] !== "=") {
+      if (--depth === 0) {
+        return /^\s*\(/.test(code.slice(i + 1));
+      }
+    } else if (char === "=" && code[i + 1] !== ">") {
+      return false;
+    }
+  }
+  return false;
+}
+
 /**
  * Identifies all export statements in the supplied source code and categorises them into different types such as declarations, named, default and star exports.
  * This function processes the code to capture different forms of export statements and normalise their representation for further processing.
@@ -488,7 +512,10 @@ export function findExports(code: string): ESMExport[] {
       | string
       | undefined;
     if (extraNamesStr) {
-      const extraNames = _extractExtraNames(extraNamesStr);
+      const extraNames = _extractExtraNames(
+        extraNamesStr,
+        code.slice(declaredExport.end),
+      );
       if (extraNames.length > 0) {
         declaredExport.names = [declaredExport.name, ...extraNames];
       }
```

</details>

<details><summary>reply</summary>

Done.
Fixed generic commas and arrow types; comparisons preserved. Build, lint, type checks, 189 existing tests, five reported cases passed.

</details>
