# ts-feat-knitwork-dynamic-type-import

Source: https://github.com/unjs/knitwork/pull/125

## Prompt

> I generate type declarations for auto-imports with knitwork and keep needing `typeof import("pkg").foo`. Right now I build it by hand on top of `genDynamicImport`, and end up with `typeof import("pkg")["foo"]` even when `.foo` would be valid, which is noisy.
> 
> Could knitwork export a `genDynamicTypeImport(specifier, name, options)` helper next to `genDynamicImport`?
> 
> - `specifier` is the module, `name` is an optional export name (`string | undefined`).
> - With no name: `genDynamicTypeImport("pkg", undefined)` returns `typeof import("pkg")`.
> - With a name that is a valid identifier: `genDynamicTypeImport("pkg", "foo")` returns `typeof import("pkg").foo`.
> - With a name that is not a valid identifier: `genDynamicTypeImport("pkg", "foo-bar")` returns `typeof import("pkg")["foo-bar"]`.
> - `options` should take the same `comment` and `attributes` options as `genDynamicImport` and render them the same way inside the parentheses, e.g.
>   - `{ comment: 'webpackChunkName: "chunks/dynamic"' }` with name `foo` gives `typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo`
>   - `{ attributes: { type: "json" } }` with name `foo` gives `typeof import("pkg", { with: { type: "json" } }).foo`
> 
> Please add this.

## Upstream change (tests left out)

Files: [README.md](../../tasks/ts-feat-knitwork-dynamic-type-import/upstream/README.md), [src/_utils.ts](../../tasks/ts-feat-knitwork-dynamic-type-import/upstream/src/_utils.ts), [src/esm.ts](../../tasks/ts-feat-knitwork-dynamic-type-import/upstream/src/esm.ts), [src/utils.ts](../../tasks/ts-feat-knitwork-dynamic-type-import/upstream/src/utils.ts), [test/esm.test.ts](../../tasks/ts-feat-knitwork-dynamic-type-import/upstream/test/esm.test.ts)

```diff
diff --git a/README.md b/README.md
index 3db6980..b05f13e 100644
--- a/README.md
+++ b/README.md
@@ -66,6 +66,10 @@ import {} from "https://esm.sh/knitwork";
 
 Generate an ESM dynamic `import()` statement.
 
+### `genDynamicTypeImport(specifier, name, options)`
+
+Generate an ESM type `import()` statement.
+
 ### `genExport(specifier, exports?, options)`
 
 Generate an ESM `export` statement.
diff --git a/src/_utils.ts b/src/_utils.ts
index e6ed9cf..91f1490 100644
--- a/src/_utils.ts
+++ b/src/_utils.ts
@@ -1,6 +1,8 @@
 import { ESMCodeGenOptions, ESMExport, ESMImport } from "./esm";
 import { genString } from "./string";
 
+export const VALID_IDENTIFIER_RE = /^[$_]?([A-Z_a-z]\w*|\d)$/;
+
 type ImportExportType = "import" | "export" | "import type" | "export type";
 
 export function _genStatement(
diff --git a/src/esm.ts b/src/esm.ts
index 75242ce..7f3c0b2 100644
--- a/src/esm.ts
+++ b/src/esm.ts
@@ -1,6 +1,6 @@
 import { CodegenOptions } from "./types";
 import { genString } from "./string";
-import { _genStatement } from "./_utils";
+import { _genStatement, VALID_IDENTIFIER_RE } from "./_utils";
 
 // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import
 export type ESMImport = string | { name: string; as?: string };
@@ -105,14 +105,38 @@ export function genDynamicImport(
 ) {
   const commentString = options.comment ? ` /* ${options.comment} */` : "";
   const wrapperString = options.wrapper === false ? "" : "() => ";
-  const ineropString = options.interopDefault
+  const interopString = options.interopDefault
     ? ".then(m => m.default || m)"
     : "";
   const optionsString = _genDynamicImportAttributes(options);
   return `${wrapperString}import(${genString(
     specifier,
     options,
-  )}${commentString}${optionsString})${ineropString}`;
+  )}${commentString}${optionsString})${interopString}`;
+}
+
+/**
+ * Generate an ESM type `import()` statement.
+ *
+ * @group ESM
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name: string | undefined,
+  options: Omit<DynamicImportOptions, "wrapper" | "interopDefault"> = {},
+) {
+  const commentString = options.comment ? ` /* ${options.comment} */` : "";
+  const optionsString = _genDynamicImportAttributes(options);
+  let nameString = "";
+  if (name) {
+    nameString = VALID_IDENTIFIER_RE.test(name)
+      ? `.${name}`
+      : `[${genString(name)}]`;
+  }
+  return `typeof import(${genString(
+    specifier,
+    options,
+  )}${commentString}${optionsString})${nameString}`;
 }
 
 // --- internal ---
diff --git a/src/utils.ts b/src/utils.ts
index c78006d..046758b 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,4 @@
+import { VALID_IDENTIFIER_RE } from "./_utils";
 import { genString } from "./string";
 
 /**
@@ -20,8 +21,6 @@ export function wrapInDelimiters(
   );
 }
 
-const VALID_IDENTIFIER_RE = /^[$_]?([A-Z_a-z]\w*|\d)$/;
-
 /**
  * Generate a safe javascript variable name for an object key.
  *
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +62/-1 | 26 | 2,982 | $0.108 |
| claude | muffle | pass | +55/-0 | 31 | 3,472 | $0.096 |
| claude | hush | pass | +36/-1 | 25 | 2,269 | $0.090 |
| claude | sloth | pass | +25/-0 | 31 | 2,946 | $0.100 |
| claude | all | pass | +31/-1 | 22 | 2,058 | $0.071 |
| codex | base | pass | +38/-0 | 49 | 1,660 | - |
| codex | muffle | pass | +30/-0 | 45 | 1,879 | - |
| codex | hush | pass | +32/-0 | 44 | 1,594 | - |
| codex | sloth | pass | +33/-1 | 51 | 2,251 | - |
| codex | all | pass | +27/-0 | 46 | 2,063 | - |

### claude, base: pass

Files: [README.md](../base/claude/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/typescript.ts](../base/claude/ts-feat-knitwork-dynamic-type-import-1/files/src/typescript.ts), [test/typescript.test.ts](../base/claude/ts-feat-knitwork-dynamic-type-import-1/files/test/typescript.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..ae441a4 100644
--- a/README.md
+++ b/README.md
@@ -177,6 +177,23 @@ Generate a string with double or single quotes and handle escapes.
 
 Generate typescript `declare module` augmentation.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a typescript `typeof import()` type for a module or one of its exports.
+
+**Example:**
+
+```js
+genDynamicTypeImport("pkg", undefined);
+// ~> `typeof import("pkg")`
+
+genDynamicTypeImport("pkg", "foo");
+// ~> `typeof import("pkg").foo`
+
+genDynamicTypeImport("pkg", "foo-bar");
+// ~> `typeof import("pkg")["foo-bar"]`
+```
+
 ### `genInlineTypeImport(specifier, name, options)`
 
 Generate an typescript `typeof import()` statement for default import.
diff --git a/src/typescript.ts b/src/typescript.ts
index 27fbbe7..c88c418 100644
--- a/src/typescript.ts
+++ b/src/typescript.ts
@@ -1,5 +1,10 @@
 import { _genStatement } from "./_utils";
-import { ESMCodeGenOptions, ESMImport, genDynamicImport } from "./esm";
+import {
+  DynamicImportOptions,
+  ESMCodeGenOptions,
+  ESMImport,
+  genDynamicImport,
+} from "./esm";
 import { genString } from "./string";
 import { genObjectKey, wrapInDelimiters } from "./utils";
 
@@ -40,6 +45,45 @@ export function genInlineTypeImport(
   })}.${name}`;
 }
 
+const VALID_PROPERTY_NAME_RE = /^[$A-Z_a-z][\w$]*$/;
+
+/**
+ * Generate a typescript `typeof import()` type for a module or one of its exports.
+ *
+ * @group Typescript
+ *
+ * @example
+ *
+ * ```js
+ * genDynamicTypeImport("pkg", undefined);
+ * // ~> `typeof import("pkg")`
+ *
+ * genDynamicTypeImport("pkg", "foo");
+ * // ~> `typeof import("pkg").foo`
+ *
+ * genDynamicTypeImport("pkg", "foo-bar");
+ * // ~> `typeof import("pkg")["foo-bar"]`
+ * ```
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name?: string,
+  options: Pick<DynamicImportOptions, "comment" | "attributes" | "assert"> &
+    ESMCodeGenOptions = {},
+) {
+  const importType = `typeof ${genDynamicImport(specifier, {
+    ...options,
+    wrapper: false,
+    interopDefault: false,
+  })}`;
+  if (name === undefined) {
+    return importType;
+  }
+  return VALID_PROPERTY_NAME_RE.test(name)
+    ? `${importType}.${name}`
+    : `${importType}[${genString(name)}]`;
+}
+
 /**
  * Generate typescript object type.
  *
diff --git a/test/typescript.test.ts b/test/typescript.test.ts
index 1f32db2..dd94678 100644
--- a/test/typescript.test.ts
+++ b/test/typescript.test.ts
@@ -3,6 +3,7 @@ import {
   genInterface,
   genAugmentation,
   genInlineTypeImport,
+  genDynamicTypeImport,
   genTypeImport,
   genTypeExport,
 } from "../src";
@@ -125,6 +126,31 @@ describe("genInlineTypeImport", () => {
   }
 });
 
+const genDynamicTypeImportTests: Array<{
+  input: Parameters<typeof genDynamicTypeImport>;
+  code: string;
+}> = [
+  { input: ["pkg", undefined], code: 'typeof import("pkg")' },
+  { input: ["pkg", "foo"], code: 'typeof import("pkg").foo' },
+  { input: ["pkg", "foo-bar"], code: 'typeof import("pkg")["foo-bar"]' },
+  {
+    input: ["pkg", "foo", { comment: 'webpackChunkName: "chunks/dynamic"' }],
+    code: 'typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo',
+  },
+  {
+    input: ["pkg", "foo", { attributes: { type: "json" } }],
+    code: 'typeof import("pkg", { with: { type: "json" } }).foo',
+  },
+];
+
+describe("genDynamicTypeImport", () => {
+  for (const t of genDynamicTypeImportTests) {
+    it(genTestTitle(t.code), () => {
+      expect(genDynamicTypeImport(...t.input)).to.equal(t.code);
+    });
+  }
+});
+
 const genTypeImportTests: Array<{
   input: Parameters<typeof genTypeImport>;
   code: string;
```

</details>

<details><summary>reply</summary>

I added `genDynamicTypeImport(specifier, name?, options)` in `src/typescript.ts`, next to `genInlineTypeImport`. It's exported through the package index. The tests and `tsc --noEmit` pass.

It returns the forms you described:
- **No name:** `genDynamicTypeImport("pkg", undefined)` returns `typeof import("pkg")`.
- **Valid identifier:** `genDynamicTypeImport("pkg", "foo")` returns `typeof import("pkg").foo`.
- **Not a valid identifier:** `genDynamicTypeImport("pkg", "foo-bar")` returns `typeof import("pkg")["foo-bar"]`.
- **Options:** `comment` and `attributes` render inside the parentheses exactly as `genDynamicImport` renders them. I also pass through the deprecated `assert` option, since `genDynamicImport` still accepts it.

The valid-identifier check is a regex I wrote for this helper (`/^[$A-Z_a-z][\w$]*$/`). I didn't reuse the one in `src/utils.ts` because it rejects names like `foo$` and would bracket them unnecessarily. Reserved words such as `default` still get dot access, since they are valid property names.

I added tests for all five of your examples in `test/typescript.test.ts`, and a README entry with an example.

</details>

### claude, muffle: pass

Files: [README.md](../muffle/claude/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/esm.ts](../muffle/claude/ts-feat-knitwork-dynamic-type-import-1/files/src/esm.ts), [test/esm.test.ts](../muffle/claude/ts-feat-knitwork-dynamic-type-import-1/files/test/esm.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..34bdb7e 100644
--- a/README.md
+++ b/README.md
@@ -66,6 +66,23 @@ import {} from "https://esm.sh/knitwork";
 
 Generate an ESM dynamic `import()` statement.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a TypeScript `typeof import()` type for a module or one of its exports.
+
+**Example:**
+
+```js
+genDynamicTypeImport("pkg", undefined);
+// ~> `typeof import("pkg")`
+
+genDynamicTypeImport("pkg", "foo");
+// ~> `typeof import("pkg").foo`
+
+genDynamicTypeImport("pkg", "foo-bar");
+// ~> `typeof import("pkg")["foo-bar"]`
+```
+
 ### `genExport(specifier, exports?, options)`
 
 Generate an ESM `export` statement.
diff --git a/src/esm.ts b/src/esm.ts
index 75242ce..acb9bf1 100644
--- a/src/esm.ts
+++ b/src/esm.ts
@@ -115,8 +115,46 @@ export function genDynamicImport(
   )}${commentString}${optionsString})${ineropString}`;
 }
 
+/**
+ * Generate a TypeScript `typeof import()` type for a module or one of its exports.
+ *
+ * @group ESM
+ *
+ * @example
+ *
+ * ```js
+ * genDynamicTypeImport("pkg", undefined);
+ * // ~> `typeof import("pkg")`
+ *
+ * genDynamicTypeImport("pkg", "foo");
+ * // ~> `typeof import("pkg").foo`
+ *
+ * genDynamicTypeImport("pkg", "foo-bar");
+ * // ~> `typeof import("pkg")["foo-bar"]`
+ * ```
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name?: string,
+  options: Pick<DynamicImportOptions, "comment" | "attributes"> = {},
+) {
+  const importType = `typeof ${genDynamicImport(specifier, {
+    comment: options.comment,
+    attributes: options.attributes,
+    wrapper: false,
+  })}`;
+  if (name === undefined) {
+    return importType;
+  }
+  return IDENTIFIER_RE.test(name)
+    ? `${importType}.${name}`
+    : `${importType}[${genString(name)}]`;
+}
+
 // --- internal ---
 
+const IDENTIFIER_RE = /^[$A-Z_a-z][\w$]*$/;
+
 function _genDynamicImportAttributes(options: DynamicImportOptions = {}) {
   // TODO: Remove deprecated `assert` in the next major release
   if (typeof options.assert?.type === "string") {
diff --git a/test/esm.test.ts b/test/esm.test.ts
index dbe9e4f..06d6c72 100644
--- a/test/esm.test.ts
+++ b/test/esm.test.ts
@@ -3,6 +3,7 @@ import {
   genImport,
   genExport,
   genDynamicImport,
+  genDynamicTypeImport,
   genSafeVariableName,
 } from "../src";
 import { genTestTitle } from "./_utils";
@@ -109,6 +110,36 @@ describe("genDynamicImport", () => {
   }
 });
 
+const genDynamicTypeImportTests: Array<{
+  name?: string;
+  opts?: Parameters<typeof genDynamicTypeImport>[2];
+  code: string;
+}> = [
+  { code: 'typeof import("pkg")' },
+  { name: "foo", code: 'typeof import("pkg").foo' },
+  { name: "foo-bar", code: 'typeof import("pkg")["foo-bar"]' },
+  { name: "default", code: 'typeof import("pkg").default' },
+  { name: "1a", code: 'typeof import("pkg")["1a"]' },
+  {
+    name: "foo",
+    opts: { comment: 'webpackChunkName: "chunks/dynamic"' },
+    code: 'typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo',
+  },
+  {
+    name: "foo",
+    opts: { attributes: { type: "json" } },
+    code: 'typeof import("pkg", { with: { type: "json" } }).foo',
+  },
+];
+
+describe("genDynamicTypeImport", () => {
+  for (const t of genDynamicTypeImportTests) {
+    it(genTestTitle(t.code), () => {
+      expect(genDynamicTypeImport("pkg", t.name, t.opts)).to.equal(t.code);
+    });
+  }
+});
+
 const genSafeVariableNameTests = [
   { key: "valid_import", code: "valid_import" },
   { key: "for", code: "_for" },
```

</details>

<details><summary>reply</summary>

Tests pass; I'm now running the type-check, since the earlier `tsc` call only printed an npx notice.

I added `genDynamicTypeImport(specifier, name?, options)` in `src/esm.ts`, right after `genDynamicImport`. It's exported from the package index. Vitest (61 tests), `tsc`, eslint and prettier all pass.

- **No name:** `genDynamicTypeImport("pkg", undefined)` returns `typeof import("pkg")`.
- **Valid identifier:** `"foo"` gives `typeof import("pkg").foo`. Reserved words like `default` also use dot access.
- **Anything else:** `"foo-bar"` gives `typeof import("pkg")["foo-bar"]`.
- **Options:** it accepts only `comment` and `attributes`, and renders them through `genDynamicImport`, so the output matches your examples.

The existing `VALID_IDENTIFIER_RE` in `utils.ts` accepts a lone digit, so `.5` would have come out as invalid TypeScript. I added a separate identifier check in `esm.ts` instead.

I added tests in `test/esm.test.ts` covering each of your examples, plus `default` and `1a`. I also added a README entry by hand and didn't run `automd`, so it may regenerate slightly differently. I haven't committed anything.

</details>

### claude, hush: pass

Files: [README.md](../hush/claude/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/typescript.ts](../hush/claude/ts-feat-knitwork-dynamic-type-import-1/files/src/typescript.ts), [test/typescript.test.ts](../hush/claude/ts-feat-knitwork-dynamic-type-import-1/files/test/typescript.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..d514555 100644
--- a/README.md
+++ b/README.md
@@ -177,6 +177,10 @@ Generate a string with double or single quotes and handle escapes.
 
 Generate typescript `declare module` augmentation.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a typescript `typeof import()` statement for an optional export name.
+
 ### `genInlineTypeImport(specifier, name, options)`
 
 Generate an typescript `typeof import()` statement for default import.
diff --git a/src/typescript.ts b/src/typescript.ts
index 27fbbe7..dc59e2a 100644
--- a/src/typescript.ts
+++ b/src/typescript.ts
@@ -1,5 +1,10 @@
 import { _genStatement } from "./_utils";
-import { ESMCodeGenOptions, ESMImport, genDynamicImport } from "./esm";
+import {
+  DynamicImportOptions,
+  ESMCodeGenOptions,
+  ESMImport,
+  genDynamicImport,
+} from "./esm";
 import { genString } from "./string";
 import { genObjectKey, wrapInDelimiters } from "./utils";
 
@@ -40,6 +45,32 @@ export function genInlineTypeImport(
   })}.${name}`;
 }
 
+const VALID_PROPERTY_NAME_RE = /^[$A-Z_a-z][\w$]*$/;
+
+/**
+ * Generate a typescript `typeof import()` statement for an optional export name.
+ *
+ * @group Typescript
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name?: string,
+  options: Pick<DynamicImportOptions, "comment" | "attributes" | "assert"> &
+    ESMCodeGenOptions = {},
+) {
+  const importString = genDynamicImport(specifier, {
+    ...options,
+    wrapper: false,
+  });
+  const accessor =
+    name === undefined
+      ? ""
+      : VALID_PROPERTY_NAME_RE.test(name)
+        ? `.${name}`
+        : `[${genString(name, options)}]`;
+  return `typeof ${importString}${accessor}`;
+}
+
 /**
  * Generate typescript object type.
  *
diff --git a/test/typescript.test.ts b/test/typescript.test.ts
index 1f32db2..0c34fc3 100644
--- a/test/typescript.test.ts
+++ b/test/typescript.test.ts
@@ -3,6 +3,7 @@ import {
   genInterface,
   genAugmentation,
   genInlineTypeImport,
+  genDynamicTypeImport,
   genTypeImport,
   genTypeExport,
 } from "../src";
@@ -170,3 +171,27 @@ describe("genTypeExport", () => {
     });
   }
 });
+
+describe("genDynamicTypeImport", () => {
+  const tests: Array<{
+    input: Parameters<typeof genDynamicTypeImport>;
+    code: string;
+  }> = [
+    { input: ["pkg", undefined], code: 'typeof import("pkg")' },
+    { input: ["pkg", "foo"], code: 'typeof import("pkg").foo' },
+    { input: ["pkg", "foo-bar"], code: 'typeof import("pkg")["foo-bar"]' },
+    {
+      input: ["pkg", "foo", { comment: 'webpackChunkName: "chunks/dynamic"' }],
+      code: 'typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo',
+    },
+    {
+      input: ["pkg", "foo", { attributes: { type: "json" } }],
+      code: 'typeof import("pkg", { with: { type: "json" } }).foo',
+    },
+  ];
+  for (const t of tests) {
+    it(t.code, () => {
+      expect(genDynamicTypeImport(...t.input)).toBe(t.code);
+    });
+  }
+});
```

</details>

<details><summary>reply</summary>

Done. Added `genDynamicTypeImport(specifier, name?, options)` in `src/typescript.ts`, exported through the index, with tests and a README entry. Tests, tsc and prettier pass. Not committed.

</details>

### claude, sloth: pass

Files: [README.md](../sloth/claude/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/esm.ts](../sloth/claude/ts-feat-knitwork-dynamic-type-import-1/files/src/esm.ts), [test/esm.test.ts](../sloth/claude/ts-feat-knitwork-dynamic-type-import-1/files/test/esm.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..4a95b10 100644
--- a/README.md
+++ b/README.md
@@ -66,6 +66,10 @@ import {} from "https://esm.sh/knitwork";
 
 Generate an ESM dynamic `import()` statement.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a typescript `typeof import()` type, optionally for a named export.
+
 ### `genExport(specifier, exports?, options)`
 
 Generate an ESM `export` statement.
diff --git a/src/esm.ts b/src/esm.ts
index 75242ce..bc41c0e 100644
--- a/src/esm.ts
+++ b/src/esm.ts
@@ -115,8 +115,29 @@ export function genDynamicImport(
   )}${commentString}${optionsString})${ineropString}`;
 }
 
+/**
+ * Generate a typescript `typeof import()` type, optionally for a named export.
+ *
+ * @group ESM
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name?: string,
+  options: Omit<DynamicImportOptions, "wrapper" | "interopDefault"> = {},
+) {
+  const importType = `typeof ${genDynamicImport(specifier, { ...options, wrapper: false })}`;
+  if (name === undefined) {
+    return importType;
+  }
+  return VALID_PROPERTY_NAME_RE.test(name)
+    ? `${importType}.${name}`
+    : `${importType}[${genString(name)}]`;
+}
+
 // --- internal ---
 
+const VALID_PROPERTY_NAME_RE = /^[$A-Z_a-z][\w$]*$/;
+
 function _genDynamicImportAttributes(options: DynamicImportOptions = {}) {
   // TODO: Remove deprecated `assert` in the next major release
   if (typeof options.assert?.type === "string") {
diff --git a/test/esm.test.ts b/test/esm.test.ts
index dbe9e4f..bf20b67 100644
--- a/test/esm.test.ts
+++ b/test/esm.test.ts
@@ -3,6 +3,7 @@ import {
   genImport,
   genExport,
   genDynamicImport,
+  genDynamicTypeImport,
   genSafeVariableName,
 } from "../src";
 import { genTestTitle } from "./_utils";
@@ -109,6 +110,36 @@ describe("genDynamicImport", () => {
   }
 });
 
+const genDynamicTypeImportTests: Array<{
+  name?: string;
+  opts?: Parameters<typeof genDynamicTypeImport>[2];
+  code: string;
+}> = [
+  { code: 'typeof import("pkg")' },
+  { name: "foo", code: 'typeof import("pkg").foo' },
+  { name: "foo-bar", code: 'typeof import("pkg")["foo-bar"]' },
+  { name: "1a", code: 'typeof import("pkg")["1a"]' },
+  { name: "default", code: 'typeof import("pkg").default' },
+  {
+    name: "foo",
+    opts: { comment: 'webpackChunkName: "chunks/dynamic"' },
+    code: 'typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo',
+  },
+  {
+    name: "foo",
+    opts: { attributes: { type: "json" } },
+    code: 'typeof import("pkg", { with: { type: "json" } }).foo',
+  },
+];
+
+describe("genDynamicTypeImport", () => {
+  for (const t of genDynamicTypeImportTests) {
+    it(genTestTitle(t.code), () => {
+      expect(genDynamicTypeImport("pkg", t.name, t.opts)).to.equal(t.code);
+    });
+  }
+});
+
 const genSafeVariableNameTests = [
   { key: "valid_import", code: "valid_import" },
   { key: "for", code: "_for" },
```

</details>

<details><summary>reply</summary>

`genDynamicTypeImport(specifier, name?, options)` is now exported from `src/esm.ts`, next to `genDynamicImport`. The full test suite passes (61 tests), and `tsc` and `eslint` report nothing. I haven't committed anything.

- **No name:** `genDynamicTypeImport("pkg")` gives `typeof import("pkg")`.
- **Valid identifier:** `genDynamicTypeImport("pkg", "foo")` gives `typeof import("pkg").foo`. `default` is also emitted as `.default`.
- **Not a valid identifier:** `genDynamicTypeImport("pkg", "foo-bar")` gives `typeof import("pkg")["foo-bar"]`. Names that start with a digit, like `1a`, are bracketed too.
- **Options:** it takes `comment` and `attributes` and renders them exactly as `genDynamicImport` does. Your two examples produce the expected output. The deprecated `assert` option is accepted as well.
- **Types:** `wrapper` and `interopDefault` are left out of the options type, since they make no sense for a type.

I wrote a separate identifier check instead of reusing `genObjectKey`. Its regex accepts a lone digit like `1`, which would give the invalid `.1`.

I added tests for the cases above in `test/esm.test.ts` and an entry in the README.

</details>

### claude, all: pass

Files: [README.md](../all/claude/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/typescript.ts](../all/claude/ts-feat-knitwork-dynamic-type-import-1/files/src/typescript.ts), [test/typescript.test.ts](../all/claude/ts-feat-knitwork-dynamic-type-import-1/files/test/typescript.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..608021f 100644
--- a/README.md
+++ b/README.md
@@ -177,6 +177,10 @@ Generate a string with double or single quotes and handle escapes.
 
 Generate typescript `declare module` augmentation.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a typescript `typeof import()` type, optionally for a named export.
+
 ### `genInlineTypeImport(specifier, name, options)`
 
 Generate an typescript `typeof import()` statement for default import.
diff --git a/src/typescript.ts b/src/typescript.ts
index 27fbbe7..187d413 100644
--- a/src/typescript.ts
+++ b/src/typescript.ts
@@ -1,5 +1,10 @@
 import { _genStatement } from "./_utils";
-import { ESMCodeGenOptions, ESMImport, genDynamicImport } from "./esm";
+import {
+  DynamicImportOptions,
+  ESMCodeGenOptions,
+  ESMImport,
+  genDynamicImport,
+} from "./esm";
 import { genString } from "./string";
 import { genObjectKey, wrapInDelimiters } from "./utils";
 
@@ -40,6 +45,27 @@ export function genInlineTypeImport(
   })}.${name}`;
 }
 
+/**
+ * Generate a typescript `typeof import()` type, optionally for a named export.
+ *
+ * @group Typescript
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name?: string,
+  options: Pick<DynamicImportOptions, "comment" | "attributes"> = {},
+) {
+  const importType = `typeof ${genDynamicImport(specifier, {
+    ...options,
+    wrapper: false,
+  })}`;
+  if (name === undefined) {
+    return importType;
+  }
+  const key = genObjectKey(name);
+  return key === name ? `${importType}.${name}` : `${importType}[${key}]`;
+}
+
 /**
  * Generate typescript object type.
  *
diff --git a/test/typescript.test.ts b/test/typescript.test.ts
index 1f32db2..38db433 100644
--- a/test/typescript.test.ts
+++ b/test/typescript.test.ts
@@ -3,6 +3,7 @@ import {
   genInterface,
   genAugmentation,
   genInlineTypeImport,
+  genDynamicTypeImport,
   genTypeImport,
   genTypeExport,
 } from "../src";
@@ -116,6 +117,27 @@ const genInlineTypeImportTests: Array<{
   },
 ];
 
+describe("genDynamicTypeImport", () => {
+  const tests: Array<[Parameters<typeof genDynamicTypeImport>, string]> = [
+    [["pkg", undefined], 'typeof import("pkg")'],
+    [["pkg", "foo"], 'typeof import("pkg").foo'],
+    [["pkg", "foo-bar"], 'typeof import("pkg")["foo-bar"]'],
+    [
+      ["pkg", "foo", { comment: 'webpackChunkName: "chunks/dynamic"' }],
+      'typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo',
+    ],
+    [
+      ["pkg", "foo", { attributes: { type: "json" } }],
+      'typeof import("pkg", { with: { type: "json" } }).foo',
+    ],
+  ];
+  for (const [input, code] of tests) {
+    it(genTestTitle(code), () => {
+      expect(genDynamicTypeImport(...input)).to.equal(code);
+    });
+  }
+});
+
 describe("genInlineTypeImport", () => {
   for (const t of genInlineTypeImportTests) {
     it(genTestTitle(t.code), () => {
```

</details>

<details><summary>reply</summary>

Done. `genDynamicTypeImport` is in `src/typescript.ts`, with tests covering all five of your examples and a README entry. Vitest passes. `tsc` didn't run, because `npx` printed a notice instead of type-checking.

</details>

### codex, base: pass

Files: [README.md](../base/codex/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/esm.ts](../base/codex/ts-feat-knitwork-dynamic-type-import-1/files/src/esm.ts), [test/esm.test.ts](../base/codex/ts-feat-knitwork-dynamic-type-import-1/files/test/esm.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..1b57a2b 100644
--- a/README.md
+++ b/README.md
@@ -66,6 +66,21 @@ import {} from "https://esm.sh/knitwork";
 
 Generate an ESM dynamic `import()` statement.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a TypeScript `typeof import()` expression with an optional export name.
+
+```js
+genDynamicTypeImport("pkg");
+// ~> `typeof import("pkg")`
+
+genDynamicTypeImport("pkg", "foo");
+// ~> `typeof import("pkg").foo`
+
+genDynamicTypeImport("pkg", "foo-bar");
+// ~> `typeof import("pkg")["foo-bar"]`
+```
+
 ### `genExport(specifier, exports?, options)`
 
 Generate an ESM `export` statement.
diff --git a/src/esm.ts b/src/esm.ts
index 75242ce..709da65 100644
--- a/src/esm.ts
+++ b/src/esm.ts
@@ -115,6 +115,29 @@ export function genDynamicImport(
   )}${commentString}${optionsString})${ineropString}`;
 }
 
+/**
+ * Generate a TypeScript `typeof import()` expression with an optional export name.
+ *
+ * @group ESM
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name?: string,
+  options: Omit<DynamicImportOptions, "wrapper" | "interopDefault"> = {},
+) {
+  const importString = `typeof ${genDynamicImport(specifier, {
+    ...options,
+    wrapper: false,
+    interopDefault: false,
+  })}`;
+  if (name === undefined) {
+    return importString;
+  }
+  return /^[$\p{ID_Start}_][$\p{ID_Continue}\u200C\u200D]*$/u.test(name)
+    ? `${importString}.${name}`
+    : `${importString}[${genString(name, options)}]`;
+}
+
 // --- internal ---
 
 function _genDynamicImportAttributes(options: DynamicImportOptions = {}) {
diff --git a/test/esm.test.ts b/test/esm.test.ts
index dbe9e4f..ff0267d 100644
--- a/test/esm.test.ts
+++ b/test/esm.test.ts
@@ -3,6 +3,7 @@ import {
   genImport,
   genExport,
   genDynamicImport,
+  genDynamicTypeImport,
   genSafeVariableName,
 } from "../src";
 import { genTestTitle } from "./_utils";
@@ -109,6 +110,54 @@ describe("genDynamicImport", () => {
   }
 });
 
+describe("genDynamicTypeImport", () => {
+  const tests: Array<{
+    input: Parameters<typeof genDynamicTypeImport>;
+    code: string;
+  }> = [
+    { input: ["pkg"], code: 'typeof import("pkg")' },
+    { input: ["pkg", undefined], code: 'typeof import("pkg")' },
+    ...["foo", "default", "$", "_", "foo$bar", "café", "变量"].map((name) => ({
+      input: ["pkg", name] as Parameters<typeof genDynamicTypeImport>,
+      code: `typeof import("pkg").${name}`,
+    })),
+    ...["foo-bar", "", "123", "1foo", "foo.bar", 'foo"bar'].map((name) => ({
+      input: ["pkg", name] as Parameters<typeof genDynamicTypeImport>,
+      code: `typeof import("pkg")[${JSON.stringify(name)}]`,
+    })),
+    {
+      input: ["pkg", "foo", { comment: 'webpackChunkName: "chunks/dynamic"' }],
+      code: 'typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo',
+    },
+    {
+      input: ["pkg", "foo", { attributes: { type: "json" } }],
+      code: 'typeof import("pkg", { with: { type: "json" } }).foo',
+    },
+    {
+      input: [
+        "pkg",
+        undefined,
+        { attributes: { type: "json" }, comment: "chunk" },
+      ],
+      code: 'typeof import("pkg" /* chunk */, { with: { type: "json" } })',
+    },
+    {
+      input: ["pkg", "foo-bar", { assert: { type: "json" } }],
+      code: 'typeof import("pkg", { assert: { type: "json" } })["foo-bar"]',
+    },
+    {
+      input: ["pkg", "foo-bar", { singleQuotes: true }],
+      code: "typeof import('pkg')['foo-bar']",
+    },
+  ];
+
+  for (const t of tests) {
+    it(genTestTitle(t.code), () => {
+      expect(genDynamicTypeImport(...t.input)).to.equal(t.code);
+    });
+  }
+});
+
 const genSafeVariableNameTests = [
   { key: "valid_import", code: "valid_import" },
   { key: "for", code: "_for" },
```

</details>

<details><summary>reply</summary>

I’ll check the existing helpers and tests, add `genDynamicTypeImport` alongside them, and verify its output.

Added and exported `genDynamicTypeImport(specifier, name?, options)`.

It supports omitted names, dot access for valid identifiers, escaped bracket access for other names, and the existing comment and import attributes formatting. Added documentation and edge-case tests.

Validation passed: all 74 tests, lint, formatting, and build.

</details>

### codex, muffle: pass

Files: [README.md](../muffle/codex/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/esm.ts](../muffle/codex/ts-feat-knitwork-dynamic-type-import-1/files/src/esm.ts), [test/esm.test.ts](../muffle/codex/ts-feat-knitwork-dynamic-type-import-1/files/test/esm.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..003b879 100644
--- a/README.md
+++ b/README.md
@@ -66,6 +66,10 @@ import {} from "https://esm.sh/knitwork";
 
 Generate an ESM dynamic `import()` statement.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a TypeScript `typeof import()` expression with an optional export name.
+
 ### `genExport(specifier, exports?, options)`
 
 Generate an ESM `export` statement.
diff --git a/src/esm.ts b/src/esm.ts
index 75242ce..8077665 100644
--- a/src/esm.ts
+++ b/src/esm.ts
@@ -115,6 +115,32 @@ export function genDynamicImport(
   )}${commentString}${optionsString})${ineropString}`;
 }
 
+/**
+ * Generate a TypeScript `typeof import()` expression with an optional export name.
+ *
+ * @group ESM
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name?: string,
+  options: Omit<DynamicImportOptions, "wrapper" | "interopDefault"> = {},
+) {
+  const importString = `typeof ${genDynamicImport(specifier, {
+    ...options,
+    wrapper: false,
+    interopDefault: false,
+  })}`;
+  if (name === undefined) {
+    return importString;
+  }
+  const accessor = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u.test(
+    name,
+  )
+    ? `.${name}`
+    : `[${genString(name, options)}]`;
+  return `${importString}${accessor}`;
+}
+
 // --- internal ---
 
 function _genDynamicImportAttributes(options: DynamicImportOptions = {}) {
diff --git a/test/esm.test.ts b/test/esm.test.ts
index dbe9e4f..1286a98 100644
--- a/test/esm.test.ts
+++ b/test/esm.test.ts
@@ -3,6 +3,7 @@ import {
   genImport,
   genExport,
   genDynamicImport,
+  genDynamicTypeImport,
   genSafeVariableName,
 } from "../src";
 import { genTestTitle } from "./_utils";
@@ -109,6 +110,50 @@ describe("genDynamicImport", () => {
   }
 });
 
+const genDynamicTypeImportTests: Array<{
+  input: Parameters<typeof genDynamicTypeImport>;
+  code: string;
+}> = [
+  { input: ["pkg"], code: 'typeof import("pkg")' },
+  { input: ["pkg", undefined], code: 'typeof import("pkg")' },
+  { input: ["pkg", "foo"], code: 'typeof import("pkg").foo' },
+  { input: ["pkg", "default"], code: 'typeof import("pkg").default' },
+  { input: ["pkg", "$_foo$"], code: 'typeof import("pkg").$_foo$' },
+  { input: ["pkg", "café"], code: 'typeof import("pkg").café' },
+  { input: ["pkg", "foo-bar"], code: 'typeof import("pkg")["foo-bar"]' },
+  { input: ["pkg", "123"], code: 'typeof import("pkg")["123"]' },
+  { input: ["pkg", ""], code: 'typeof import("pkg")[""]' },
+  { input: ["pkg", 'a"b'], code: 'typeof import("pkg")["a\\"b"]' },
+  {
+    input: ["pkg", "foo", { comment: 'webpackChunkName: "chunks/dynamic"' }],
+    code: 'typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo',
+  },
+  {
+    input: ["pkg", "foo", { attributes: { type: "json" } }],
+    code: 'typeof import("pkg", { with: { type: "json" } }).foo',
+  },
+  {
+    input: [
+      "pkg",
+      undefined,
+      { comment: "chunk", attributes: { type: "json" } },
+    ],
+    code: 'typeof import("pkg" /* chunk */, { with: { type: "json" } })',
+  },
+  {
+    input: ["pkg", "foo-bar", { singleQuotes: true }],
+    code: "typeof import('pkg')['foo-bar']",
+  },
+];
+
+describe("genDynamicTypeImport", () => {
+  for (const t of genDynamicTypeImportTests) {
+    it(genTestTitle(t.code), () => {
+      expect(genDynamicTypeImport(...t.input)).to.equal(t.code);
+    });
+  }
+});
+
 const genSafeVariableNameTests = [
   { key: "valid_import", code: "valid_import" },
   { key: "for", code: "_for" },
```

</details>

<details><summary>reply</summary>

I’ll check the existing import helpers, add `genDynamicTypeImport` alongside them, and test the requested output forms.

The helper now reuses `genDynamicImport` to render comments and attributes, then adds dot or bracket access based on the export name. I’ve added coverage for the requested examples, escaping, empty names, and Unicode identifiers. Since `pnpm` isn’t installed, I’m running the checks through the local tool binaries.

Added and exported `genDynamicTypeImport(specifier, name?, options)` alongside `genDynamicImport`.

It supports optional names, dot access for valid identifiers, escaped bracket access otherwise, and the existing comment and attributes rendering. Documentation and tests are included.

Validation passed: lint, formatting, all 68 tests, and build.

</details>

### codex, hush: pass

Files: [README.md](../hush/codex/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/esm.ts](../hush/codex/ts-feat-knitwork-dynamic-type-import-1/files/src/esm.ts), [test/esm.test.ts](../hush/codex/ts-feat-knitwork-dynamic-type-import-1/files/test/esm.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..65da941 100644
--- a/README.md
+++ b/README.md
@@ -66,6 +66,12 @@ import {} from "https://esm.sh/knitwork";
 
 Generate an ESM dynamic `import()` statement.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a TypeScript `typeof import()` expression. Export names use dot notation
+for valid identifiers and bracket notation otherwise. Omit the name for the module
+type. Supports the same comments and import attributes as `genDynamicImport`.
+
 ### `genExport(specifier, exports?, options)`
 
 Generate an ESM `export` statement.
diff --git a/src/esm.ts b/src/esm.ts
index 75242ce..80a2949 100644
--- a/src/esm.ts
+++ b/src/esm.ts
@@ -115,6 +115,32 @@ export function genDynamicImport(
   )}${commentString}${optionsString})${ineropString}`;
 }
 
+/**
+ * Generate a TypeScript `typeof import()` expression.
+ *
+ * @group ESM
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name?: string,
+  options: Omit<DynamicImportOptions, "wrapper" | "interopDefault"> = {},
+) {
+  const expression = `typeof ${genDynamicImport(specifier, {
+    ...options,
+    wrapper: false,
+    interopDefault: false,
+  })}`;
+  if (name === undefined) {
+    return expression;
+  }
+  const accessor = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u.test(
+    name,
+  )
+    ? `.${name}`
+    : `[${genString(name, options)}]`;
+  return expression + accessor;
+}
+
 // --- internal ---
 
 function _genDynamicImportAttributes(options: DynamicImportOptions = {}) {
diff --git a/test/esm.test.ts b/test/esm.test.ts
index dbe9e4f..d43d3c7 100644
--- a/test/esm.test.ts
+++ b/test/esm.test.ts
@@ -3,6 +3,7 @@ import {
   genImport,
   genExport,
   genDynamicImport,
+  genDynamicTypeImport,
   genSafeVariableName,
 } from "../src";
 import { genTestTitle } from "./_utils";
@@ -109,6 +110,49 @@ describe("genDynamicImport", () => {
   }
 });
 
+describe("genDynamicTypeImport", () => {
+  const cases: Array<{
+    input: Parameters<typeof genDynamicTypeImport>;
+    code: string;
+  }> = [
+    { input: ["pkg"], code: 'typeof import("pkg")' },
+    { input: ["pkg", undefined], code: 'typeof import("pkg")' },
+    { input: ["pkg", "foo"], code: 'typeof import("pkg").foo' },
+    { input: ["pkg", "default"], code: 'typeof import("pkg").default' },
+    { input: ["pkg", "$foo"], code: 'typeof import("pkg").$foo' },
+    { input: ["pkg", "café"], code: 'typeof import("pkg").café' },
+    { input: ["pkg", "foo-bar"], code: 'typeof import("pkg")["foo-bar"]' },
+    { input: ["pkg", ""], code: 'typeof import("pkg")[""]' },
+    { input: ["pkg", "1"], code: 'typeof import("pkg")["1"]' },
+    { input: ["pkg", 'a"b'], code: 'typeof import("pkg")["a\\"b"]' },
+    {
+      input: ["pkg", "foo", { comment: 'webpackChunkName: "chunks/dynamic"' }],
+      code: 'typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo',
+    },
+    {
+      input: ["pkg", "foo", { attributes: { type: "json" } }],
+      code: 'typeof import("pkg", { with: { type: "json" } }).foo',
+    },
+    {
+      input: ["pkg", "foo-bar", { singleQuotes: true }],
+      code: "typeof import('pkg')['foo-bar']",
+    },
+    {
+      input: [
+        "pkg",
+        undefined,
+        { attributes: { type: "json" }, comment: "chunk" },
+      ],
+      code: 'typeof import("pkg" /* chunk */, { with: { type: "json" } })',
+    },
+  ];
+  for (const t of cases) {
+    it(genTestTitle(t.code), () => {
+      expect(genDynamicTypeImport(...t.input)).to.equal(t.code);
+    });
+  }
+});
+
 const genSafeVariableNameTests = [
   { key: "valid_import", code: "valid_import" },
   { key: "for", code: "_for" },
```

</details>

<details><summary>reply</summary>

Done.
Exported `genDynamicTypeImport` with optional names, dot/bracket access, comments, attributes. Docs added. Lint, 68 tests, build passed.

</details>

### codex, sloth: pass

Files: [README.md](../sloth/codex/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/typescript.ts](../sloth/codex/ts-feat-knitwork-dynamic-type-import-1/files/src/typescript.ts), [test/typescript.test.ts](../sloth/codex/ts-feat-knitwork-dynamic-type-import-1/files/test/typescript.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..107c029 100644
--- a/README.md
+++ b/README.md
@@ -177,6 +177,10 @@ Generate a string with double or single quotes and handle escapes.
 
 Generate typescript `declare module` augmentation.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a typescript `typeof import()` expression with an optional export name.
+
 ### `genInlineTypeImport(specifier, name, options)`
 
 Generate an typescript `typeof import()` statement for default import.
diff --git a/src/typescript.ts b/src/typescript.ts
index 27fbbe7..e9bc864 100644
--- a/src/typescript.ts
+++ b/src/typescript.ts
@@ -1,5 +1,10 @@
 import { _genStatement } from "./_utils";
-import { ESMCodeGenOptions, ESMImport, genDynamicImport } from "./esm";
+import {
+  DynamicImportOptions,
+  ESMCodeGenOptions,
+  ESMImport,
+  genDynamicImport,
+} from "./esm";
 import { genString } from "./string";
 import { genObjectKey, wrapInDelimiters } from "./utils";
 
@@ -40,6 +45,29 @@ export function genInlineTypeImport(
   })}.${name}`;
 }
 
+/**
+ * Generate a typescript `typeof import()` expression with an optional export name.
+ *
+ * @group Typescript
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name?: string,
+  options: Omit<DynamicImportOptions, "wrapper" | "interopDefault"> = {},
+) {
+  const importString = `typeof ${genDynamicImport(specifier, {
+    ...options,
+    wrapper: false,
+    interopDefault: false,
+  })}`;
+  if (name === undefined) {
+    return importString;
+  }
+  return /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u.test(name)
+    ? `${importString}.${name}`
+    : `${importString}[${genString(name, options)}]`;
+}
+
 /**
  * Generate typescript object type.
  *
diff --git a/test/typescript.test.ts b/test/typescript.test.ts
index 1f32db2..7cd1673 100644
--- a/test/typescript.test.ts
+++ b/test/typescript.test.ts
@@ -3,6 +3,7 @@ import {
   genInterface,
   genAugmentation,
   genInlineTypeImport,
+  genDynamicTypeImport,
   genTypeImport,
   genTypeExport,
 } from "../src";
@@ -125,6 +126,56 @@ describe("genInlineTypeImport", () => {
   }
 });
 
+const genDynamicTypeImportTests: Array<{
+  input: Parameters<typeof genDynamicTypeImport>;
+  code: string;
+}> = [
+  { input: ["pkg"], code: 'typeof import("pkg")' },
+  { input: ["pkg", undefined], code: 'typeof import("pkg")' },
+  { input: ["pkg", "foo"], code: 'typeof import("pkg").foo' },
+  { input: ["pkg", "default"], code: 'typeof import("pkg").default' },
+  { input: ["pkg", "$"], code: 'typeof import("pkg").$' },
+  { input: ["pkg", "_foo2"], code: 'typeof import("pkg")._foo2' },
+  { input: ["pkg", "\u03C0"], code: 'typeof import("pkg").\u03C0' },
+  { input: ["pkg", "foo-bar"], code: 'typeof import("pkg")["foo-bar"]' },
+  { input: ["pkg", ""], code: 'typeof import("pkg")[""]' },
+  { input: ["pkg", "0"], code: 'typeof import("pkg")["0"]' },
+  { input: ["pkg", "foo.bar"], code: 'typeof import("pkg")["foo.bar"]' },
+  {
+    input: ["pkg", 'foo"bar'],
+    code: 'typeof import("pkg")["foo\\"bar"]',
+  },
+  {
+    input: ["pkg", "foo", { comment: 'webpackChunkName: "chunks/dynamic"' }],
+    code: 'typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo',
+  },
+  {
+    input: ["pkg", "foo", { attributes: { type: "json" } }],
+    code: 'typeof import("pkg", { with: { type: "json" } }).foo',
+  },
+  {
+    input: [
+      "pkg",
+      undefined,
+      { comment: "chunk", attributes: { type: "json" } },
+    ],
+    code: 'typeof import("pkg" /* chunk */, { with: { type: "json" } })',
+  },
+  {
+    input: ["pkg", "foo-bar", { singleQuotes: true }],
+    code: "typeof import('pkg')['foo-bar']",
+  },
+];
+
+describe("genDynamicTypeImport", () => {
+  for (const t of genDynamicTypeImportTests) {
+    it(genTestTitle(t.code), () => {
+      const code = genDynamicTypeImport(...t.input);
+      expect(code).to.equal(t.code);
+    });
+  }
+});
+
 const genTypeImportTests: Array<{
   input: Parameters<typeof genTypeImport>;
   code: string;
```

</details>

<details><summary>reply</summary>

I’ll check the existing generators, exports, and tests, then add the helper using the same options and rendering conventions.

The change needs a TypeScript generator, tests, and an API documentation entry; the existing barrel export will expose it automatically. I’ll reuse `genDynamicImport` for comments and attributes and leave `genInlineTypeImport` unchanged.

The object-key helper accepts numeric keys, which aren’t valid after a dot, so this helper needs an identifier check of its own. No new dependencies or configuration are needed.

Added and exported `genDynamicTypeImport` with optional names, dot or bracket access, and shared comment/attributes rendering. Updated API docs and added edge-case tests.

Validation passed: all 70 tests, lint, formatting, typecheck, and build. Used installed binaries because `pnpm` was unavailable.

</details>

### codex, all: pass

Files: [README.md](../all/codex/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/esm.ts](../all/codex/ts-feat-knitwork-dynamic-type-import-1/files/src/esm.ts), [test/esm.test.ts](../all/codex/ts-feat-knitwork-dynamic-type-import-1/files/test/esm.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..003b879 100644
--- a/README.md
+++ b/README.md
@@ -66,6 +66,10 @@ import {} from "https://esm.sh/knitwork";
 
 Generate an ESM dynamic `import()` statement.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a TypeScript `typeof import()` expression with an optional export name.
+
 ### `genExport(specifier, exports?, options)`
 
 Generate an ESM `export` statement.
diff --git a/src/esm.ts b/src/esm.ts
index 75242ce..5b53e50 100644
--- a/src/esm.ts
+++ b/src/esm.ts
@@ -115,6 +115,29 @@ export function genDynamicImport(
   )}${commentString}${optionsString})${ineropString}`;
 }
 
+/**
+ * Generate a TypeScript `typeof import()` expression with an optional export name.
+ *
+ * @group ESM
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name?: string,
+  options: Omit<DynamicImportOptions, "wrapper" | "interopDefault"> = {},
+) {
+  let property = "";
+  if (name !== undefined) {
+    property = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u.test(name)
+      ? `.${name}`
+      : `[${genString(name, options)}]`;
+  }
+  return `typeof ${genDynamicImport(specifier, {
+    ...options,
+    wrapper: false,
+    interopDefault: false,
+  })}${property}`;
+}
+
 // --- internal ---
 
 function _genDynamicImportAttributes(options: DynamicImportOptions = {}) {
diff --git a/test/esm.test.ts b/test/esm.test.ts
index dbe9e4f..163fa8d 100644
--- a/test/esm.test.ts
+++ b/test/esm.test.ts
@@ -3,6 +3,7 @@ import {
   genImport,
   genExport,
   genDynamicImport,
+  genDynamicTypeImport,
   genSafeVariableName,
 } from "../src";
 import { genTestTitle } from "./_utils";
@@ -109,6 +110,51 @@ describe("genDynamicImport", () => {
   }
 });
 
+const genDynamicTypeImportTests: Array<{
+  input: Parameters<typeof genDynamicTypeImport>;
+  code: string;
+}> = [
+  { input: ["pkg"], code: 'typeof import("pkg")' },
+  { input: ["pkg", undefined], code: 'typeof import("pkg")' },
+  { input: ["pkg", "foo"], code: 'typeof import("pkg").foo' },
+  { input: ["pkg", "default"], code: 'typeof import("pkg").default' },
+  { input: ["pkg", "$"], code: 'typeof import("pkg").$' },
+  { input: ["pkg", "_foo1"], code: 'typeof import("pkg")._foo1' },
+  { input: ["pkg", "日本語"], code: 'typeof import("pkg").日本語' },
+  { input: ["pkg", "foo-bar"], code: 'typeof import("pkg")["foo-bar"]' },
+  { input: ["pkg", ""], code: 'typeof import("pkg")[""]' },
+  { input: ["pkg", "1"], code: 'typeof import("pkg")["1"]' },
+  { input: ["pkg", 'foo"bar'], code: 'typeof import("pkg")["foo\\"bar"]' },
+  {
+    input: ["pkg", "foo", { comment: 'webpackChunkName: "chunks/dynamic"' }],
+    code: 'typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo',
+  },
+  {
+    input: ["pkg", "foo", { attributes: { type: "json" } }],
+    code: 'typeof import("pkg", { with: { type: "json" } }).foo',
+  },
+  {
+    input: [
+      "pkg",
+      undefined,
+      { comment: "chunk", attributes: { type: "json" } },
+    ],
+    code: 'typeof import("pkg" /* chunk */, { with: { type: "json" } })',
+  },
+  {
+    input: ["pkg", "foo-bar", { singleQuotes: true }],
+    code: "typeof import('pkg')['foo-bar']",
+  },
+];
+
+describe("genDynamicTypeImport", () => {
+  for (const t of genDynamicTypeImportTests) {
+    it(genTestTitle(t.code), () => {
+      expect(genDynamicTypeImport(...t.input)).to.equal(t.code);
+    });
+  }
+});
+
 const genSafeVariableNameTests = [
   { key: "valid_import", code: "valid_import" },
   { key: "for", code: "_for" },
```

</details>

<details><summary>reply</summary>

Done.
Exported `genDynamicTypeImport` with identifier-aware access, comments, attributes, docs, edge-case tests. Lint, 69 tests, build passed.

</details>
