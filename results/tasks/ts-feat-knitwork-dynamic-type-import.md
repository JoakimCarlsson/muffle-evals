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
| claude | muffle | pass | +25/-0 | 27 | 2,342 | $0.072 |
| claude | hush | pass | +28/-0 | 21 | 3,709 | $0.123 |
| claude | sloth | pass | +36/-1 | 0 | 2,046 | $0.083 |
| claude | all | pass | +33/-1 | 0 | 2,376 | $0.095 |
| codex | base | pass | +38/-0 | 49 | 1,660 | - |
| codex | muffle | pass | +30/-0 | 48 | 1,657 | - |
| codex | hush | pass | +35/-0 | 46 | 1,639 | - |
| codex | sloth | pass | +27/-0 | 0 | 1,065 | - |
| codex | all | pass | +27/-0 | 0 | 1,196 | - |

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

Files: [README.md](../muffle/claude/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/typescript.ts](../muffle/claude/ts-feat-knitwork-dynamic-type-import-1/files/src/typescript.ts), [test/typescript.test.ts](../muffle/claude/ts-feat-knitwork-dynamic-type-import-1/files/test/typescript.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..b3613e5 100644
--- a/README.md
+++ b/README.md
@@ -177,6 +177,10 @@ Generate a string with double or single quotes and handle escapes.
 
 Generate typescript `declare module` augmentation.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a typescript `typeof import()` type for a module or one of its exports.
+
 ### `genInlineTypeImport(specifier, name, options)`
 
 Generate an typescript `typeof import()` statement for default import.
diff --git a/src/typescript.ts b/src/typescript.ts
index 27fbbe7..ae039f5 100644
--- a/src/typescript.ts
+++ b/src/typescript.ts
@@ -3,6 +3,8 @@ import { ESMCodeGenOptions, ESMImport, genDynamicImport } from "./esm";
 import { genString } from "./string";
 import { genObjectKey, wrapInDelimiters } from "./utils";
 
+const VALID_PROPERTY_RE = /^[$A-Z_a-z][\w$]*$/;
+
 export type TypeObject = {
   [key: string]: string | TypeObject;
 };
@@ -40,6 +42,25 @@ export function genInlineTypeImport(
   })}.${name}`;
 }
 
+/**
+ * Generate a typescript `typeof import()` type for a module or one of its exports.
+ *
+ * @group Typescript
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name?: string,
+  options: ESMCodeGenOptions = {},
+) {
+  const imp = genDynamicImport(specifier, { ...options, wrapper: false });
+  if (name === undefined) {
+    return `typeof ${imp}`;
+  }
+  return VALID_PROPERTY_RE.test(name)
+    ? `typeof ${imp}.${name}`
+    : `typeof ${imp}[${genString(name)}]`;
+}
+
 /**
  * Generate typescript object type.
  *
diff --git a/test/typescript.test.ts b/test/typescript.test.ts
index 1f32db2..6ba81c1 100644
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
@@ -125,6 +126,32 @@ describe("genInlineTypeImport", () => {
   }
 });
 
+const genDynamicTypeImportTests: Array<{
+  input: Parameters<typeof genDynamicTypeImport>;
+  code: string;
+}> = [
+  { input: ["pkg", undefined], code: 'typeof import("pkg")' },
+  { input: ["pkg", "foo"], code: 'typeof import("pkg").foo' },
+  { input: ["pkg", "foo-bar"], code: 'typeof import("pkg")["foo-bar"]' },
+  { input: ["pkg", "1a"], code: 'typeof import("pkg")["1a"]' },
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

I added `genDynamicTypeImport(specifier, name?, options)` in `src/typescript.ts`. It's exported from the package index, so it sits alongside `genDynamicImport`. The tests and `tsc --noEmit` pass.

- **No name:** it returns `typeof import("pkg")`.
- **Valid identifier:** `"foo"` gives `typeof import("pkg").foo`.
- **Anything else:** `"foo-bar"` gives `typeof import("pkg")["foo-bar"]`.
- **Options:** `comment` and `attributes` go through `genDynamicImport`, so they render exactly as you described, for example `typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo` and `typeof import("pkg", { with: { type: "json" } }).foo`.

I used a separate identifier check instead of the one behind `genObjectKey`, because that one accepts a bare digit like `"1"`, which isn't valid after a dot. Names that start with a digit, such as `"1a"`, fall back to bracket form. The check is ASCII-only, so a name with non-ASCII letters also gets the bracket form, which is always valid.

I added tests for all the cases above in `test/typescript.test.ts` and a short entry in the README. I didn't commit anything.

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
index 27fbbe7..f6a8bef 100644
--- a/src/typescript.ts
+++ b/src/typescript.ts
@@ -3,6 +3,8 @@ import { ESMCodeGenOptions, ESMImport, genDynamicImport } from "./esm";
 import { genString } from "./string";
 import { genObjectKey, wrapInDelimiters } from "./utils";
 
+const VALID_PROPERTY_RE = /^[$A-Z_a-z][\w$]*$/;
+
 export type TypeObject = {
   [key: string]: string | TypeObject;
 };
@@ -40,6 +42,28 @@ export function genInlineTypeImport(
   })}.${name}`;
 }
 
+/**
+ * Generate a typescript `typeof import()` statement for an optional export name.
+ *
+ * @group Typescript
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name?: string,
+  options: ESMCodeGenOptions & { comment?: string } = {},
+) {
+  const importType = `typeof ${genDynamicImport(specifier, {
+    ...options,
+    wrapper: false,
+  })}`;
+  if (name === undefined) {
+    return importType;
+  }
+  return VALID_PROPERTY_RE.test(name)
+    ? `${importType}.${name}`
+    : `${importType}[${genString(name)}]`;
+}
+
 /**
  * Generate typescript object type.
  *
diff --git a/test/typescript.test.ts b/test/typescript.test.ts
index 1f32db2..b3cad0f 100644
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
@@ -170,3 +171,23 @@ describe("genTypeExport", () => {
     });
   }
 });
+
+describe("genDynamicTypeImport", () => {
+  it("generates type imports", () => {
+    expect(genDynamicTypeImport("pkg", undefined)).toBe('typeof import("pkg")');
+    expect(genDynamicTypeImport("pkg", "foo")).toBe('typeof import("pkg").foo');
+    expect(genDynamicTypeImport("pkg", "foo-bar")).toBe(
+      'typeof import("pkg")["foo-bar"]',
+    );
+    expect(
+      genDynamicTypeImport("pkg", "foo", {
+        comment: 'webpackChunkName: "chunks/dynamic"',
+      }),
+    ).toBe(
+      'typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */).foo',
+    );
+    expect(
+      genDynamicTypeImport("pkg", "foo", { attributes: { type: "json" } }),
+    ).toBe('typeof import("pkg", { with: { type: "json" } }).foo');
+  });
+});
```

</details>

<details><summary>reply</summary>

Stray hung command blocked the test append. Cleaning up `/tmp/x`, then adding the test.

Done. Added `genDynamicTypeImport` in `src/typescript.ts`, with a README entry and a test; vitest and tsc pass. Not committed.

</details>

### claude, sloth: pass

Files: [README.md](../sloth/claude/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/typescript.ts](../sloth/claude/ts-feat-knitwork-dynamic-type-import-1/files/src/typescript.ts)

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
index 27fbbe7..1863ac9 100644
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
 
+const PROPERTY_NAME_RE = /^[$A-Z_a-z][\w$]*$/;
+
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
+  const importString = genDynamicImport(specifier, {
+    comment: options.comment,
+    attributes: options.attributes,
+    wrapper: false,
+  });
+  if (name === undefined) {
+    return `typeof ${importString}`;
+  }
+  const accessor = PROPERTY_NAME_RE.test(name)
+    ? `.${name}`
+    : `[${genString(name)}]`;
+  return `typeof ${importString}${accessor}`;
+}
+
 /**
  * Generate typescript object type.
  *
```

</details>

<details><summary>reply</summary>

I added `genDynamicTypeImport(specifier, name?, options)` next to the other TypeScript helpers in `src/typescript.ts`, and it's exported from the package index. I also added a README entry for it.

A throwaway test (since deleted) confirmed all five of your examples produce exactly the strings you listed. `tsc --noEmit` is clean and the 54 existing tests pass. I didn't add a permanent test for the new helper, since you didn't ask for one.

- **Options:** `options` takes only `comment` and `attributes`. `wrapper` and `interopDefault` make no sense in a type, so they aren't accepted.
- **Identifier check:** It uses its own regex rather than the one behind `genObjectKey`. That regex accepts a lone digit like `"1"`, which would give the invalid `.1`, so `"1"` gets the bracket form instead.
- **Existing helper:** I left `genInlineTypeImport` as it is.

</details>

### claude, all: pass

Files: [README.md](../all/claude/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/typescript.ts](../all/claude/ts-feat-knitwork-dynamic-type-import-1/files/src/typescript.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..3d8f545 100644
--- a/README.md
+++ b/README.md
@@ -177,6 +177,10 @@ Generate a string with double or single quotes and handle escapes.
 
 Generate typescript `declare module` augmentation.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a typescript `typeof import()` type, using dot access for valid identifiers.
+
 ### `genInlineTypeImport(specifier, name, options)`
 
 Generate an typescript `typeof import()` statement for default import.
diff --git a/src/typescript.ts b/src/typescript.ts
index 27fbbe7..a41e3fa 100644
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
+ * Generate a typescript `typeof import()` type, using dot access for valid identifiers.
+ *
+ * @group Typescript
+ */
+export function genDynamicTypeImport(
+  specifier: string,
+  name?: string,
+  options: Pick<DynamicImportOptions, "comment" | "attributes"> &
+    ESMCodeGenOptions = {},
+) {
+  const importType = `typeof ${genDynamicImport(specifier, {
+    ...options,
+    wrapper: false,
+  })}`;
+  if (name === undefined) {
+    return importType;
+  }
+  return /^[$A-Z_a-z][\w$]*$/.test(name)
+    ? `${importType}.${name}`
+    : `${importType}[${genString(name, options)}]`;
+}
+
 /**
  * Generate typescript object type.
  *
```

</details>

<details><summary>reply</summary>

Done. I added `genDynamicTypeImport` to `src/typescript.ts` and a README entry. It's exported through the existing `export *`.

I ran all five of your examples and each produced the expected string. `tsc` is clean and the 54 existing tests pass. I added no tests, since you didn't ask for any.

One difference from `genObjectKey`: a bare digit like `"1"` gets bracket access here, because `typeof import("pkg").1` isn't valid.

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
index dbe9e4f..2e1a4d3 100644
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
@@ -124,3 +125,50 @@ describe("genSafeVariableName", () => {
     });
   }
 });
+
+const genDynamicTypeImportTests: Array<{
+  input: Parameters<typeof genDynamicTypeImport>;
+  code: string;
+}> = [
+  { input: ["pkg"], code: 'typeof import("pkg")' },
+  { input: ["pkg", undefined], code: 'typeof import("pkg")' },
+  { input: ["pkg", "foo"], code: 'typeof import("pkg").foo' },
+  { input: ["pkg", "default"], code: 'typeof import("pkg").default' },
+  { input: ["pkg", "$foo_1"], code: 'typeof import("pkg").$foo_1' },
+  { input: ["pkg", "é"], code: 'typeof import("pkg").é' },
+  { input: ["pkg", "foo-bar"], code: 'typeof import("pkg")["foo-bar"]' },
+  { input: ["pkg", "1foo"], code: 'typeof import("pkg")["1foo"]' },
+  { input: ["pkg", ""], code: 'typeof import("pkg")[""]' },
+  {
+    input: ["pkg", 'foo"bar'],
+    code: 'typeof import("pkg")["foo\\"bar"]',
+  },
+  {
+    input: ["pkg", "foo-bar", { singleQuotes: true }],
+    code: "typeof import('pkg')['foo-bar']",
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
+];
+
+describe("genDynamicTypeImport", () => {
+  for (const t of genDynamicTypeImportTests) {
+    it(genTestTitle(t.code), () => {
+      expect(genDynamicTypeImport(...t.input)).to.equal(t.code);
+    });
+  }
+});
```

</details>

<details><summary>reply</summary>

I’ll check how `genDynamicImport` handles options, add the helper, and test the requested output forms.

Added and exported `genDynamicTypeImport(specifier, name?, options)` alongside `genDynamicImport`.

It handles omitted names, dot access for valid identifiers, bracket access for other names, and existing comment, attributes, and quoting options. Added README documentation and regression tests.

Validation passed: all 68 tests, lint, formatting, TypeScript checks, and build.

</details>

### codex, hush: pass

Files: [README.md](../hush/codex/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/esm.ts](../hush/codex/ts-feat-knitwork-dynamic-type-import-1/files/src/esm.ts), [test/esm.test.ts](../hush/codex/ts-feat-knitwork-dynamic-type-import-1/files/test/esm.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..508847e 100644
--- a/README.md
+++ b/README.md
@@ -66,6 +66,18 @@ import {} from "https://esm.sh/knitwork";
 
 Generate an ESM dynamic `import()` statement.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a TypeScript `typeof import()` expression. Export names use dot access
+when valid identifiers and bracket access otherwise. Supports dynamic import
+comments and attributes.
+
+```js
+genDynamicTypeImport("pkg", undefined); // typeof import("pkg")
+genDynamicTypeImport("pkg", "foo"); // typeof import("pkg").foo
+genDynamicTypeImport("pkg", "foo-bar"); // typeof import("pkg")["foo-bar"]
+```
+
 ### `genExport(specifier, exports?, options)`
 
 Generate an ESM `export` statement.
diff --git a/src/esm.ts b/src/esm.ts
index 75242ce..0fac0f7 100644
--- a/src/esm.ts
+++ b/src/esm.ts
@@ -115,6 +115,29 @@ export function genDynamicImport(
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
+  return /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u.test(name)
+    ? `${expression}.${name}`
+    : `${expression}[${genString(name, options)}]`;
+}
+
 // --- internal ---
 
 function _genDynamicImportAttributes(options: DynamicImportOptions = {}) {
diff --git a/test/esm.test.ts b/test/esm.test.ts
index dbe9e4f..5b73a79 100644
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
 
+describe("genDynamicTypeImport", () => {
+  it.each([
+    [undefined, 'typeof import("pkg")'],
+    ["foo", 'typeof import("pkg").foo'],
+    ["default", 'typeof import("pkg").default'],
+    ["$foo_1", 'typeof import("pkg").$foo_1'],
+    ["é", 'typeof import("pkg").é'],
+    ["foo-bar", 'typeof import("pkg")["foo-bar"]'],
+    ["1", 'typeof import("pkg")["1"]'],
+    ["", 'typeof import("pkg")[""]'],
+  ])("handles export name %j", (name, expected) => {
+    expect(genDynamicTypeImport("pkg", name)).to.equal(expected);
+  });
+
+  it("allows an omitted name", () => {
+    expect(genDynamicTypeImport("pkg")).to.equal('typeof import("pkg")');
+  });
+
+  it("preserves dynamic import comments and attributes", () => {
+    for (const t of genDynamicImportTests) {
+      expect(genDynamicTypeImport("pkg", "foo", t.opts)).to.equal(
+        `typeof ${genDynamicImport("pkg", {
+          ...t.opts,
+          wrapper: false,
+          interopDefault: false,
+        })}.foo`,
+      );
+    }
+    expect(
+      genDynamicTypeImport("pkg", "foo", {
+        comment: 'webpackChunkName: "chunks/dynamic"',
+        attributes: { type: "json" },
+      }),
+    ).to.equal(
+      'typeof import("pkg" /* webpackChunkName: "chunks/dynamic" */, { with: { type: "json" } }).foo',
+    );
+  });
+
+  it("quotes export names with the requested string options", () => {
+    expect(
+      genDynamicTypeImport("pkg", "foo-bar", { singleQuotes: true }),
+    ).to.equal("typeof import('pkg')['foo-bar']");
+  });
+});
+
 const genSafeVariableNameTests = [
   { key: "valid_import", code: "valid_import" },
   { key: "for", code: "_for" },
```

</details>

<details><summary>reply</summary>

Done.
Exported `genDynamicTypeImport` with identifier access, comments, attributes, docs. All 65 tests, lint, formatting, build passed.

</details>

### codex, sloth: pass

Files: [README.md](../sloth/codex/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/esm.ts](../sloth/codex/ts-feat-knitwork-dynamic-type-import-1/files/src/esm.ts)

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
index 75242ce..4a971e8 100644
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
+  return /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u.test(name)
+    ? `${importString}.${name}`
+    : `${importString}[${genString(name, options)}]`;
+}
+
 // --- internal ---
 
 function _genDynamicImportAttributes(options: DynamicImportOptions = {}) {
```

</details>

<details><summary>reply</summary>

I’ll check the dynamic import generator, exports, and build setup, then add the helper using the existing rendering utilities.

The change needs a helper in `src/esm.ts` and a README entry; the existing barrel export will expose it automatically. I’ll reuse `genDynamicImport` for comments, attributes, and quoting, and check identifier syntax for dot access. Existing helpers, fixtures, and config need no changes. No new dependencies or options are needed.

Added and exported `genDynamicTypeImport` with optional names, dot access for valid identifiers, and escaped bracket access otherwise. Comments and attributes use the existing dynamic import renderer. README updated.

Build, lint, formatting, and all 54 existing tests passed using local tools because `pnpm` was unavailable.

</details>

### codex, all: pass

Files: [README.md](../all/codex/ts-feat-knitwork-dynamic-type-import-1/files/README.md), [src/esm.ts](../all/codex/ts-feat-knitwork-dynamic-type-import-1/files/src/esm.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 3db6980..52208a5 100644
--- a/README.md
+++ b/README.md
@@ -66,6 +66,10 @@ import {} from "https://esm.sh/knitwork";
 
 Generate an ESM dynamic `import()` statement.
 
+### `genDynamicTypeImport(specifier, name?, options)`
+
+Generate a `typeof import()` type expression with an optional export name.
+
 ### `genExport(specifier, exports?, options)`
 
 Generate an ESM `export` statement.
diff --git a/src/esm.ts b/src/esm.ts
index 75242ce..871d345 100644
--- a/src/esm.ts
+++ b/src/esm.ts
@@ -115,6 +115,29 @@ export function genDynamicImport(
   )}${commentString}${optionsString})${ineropString}`;
 }
 
+/**
+ * Generate a `typeof import()` type expression with an optional export name.
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
+  return /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u.test(name)
+    ? `${importString}.${name}`
+    : `${importString}[${genString(name, options)}]`;
+}
+
 // --- internal ---
 
 function _genDynamicImportAttributes(options: DynamicImportOptions = {}) {
```

</details>

<details><summary>reply</summary>

Done.
Exported `genDynamicTypeImport` with identifier access, quoted fallback, shared import options; documented. Build, lint, 54 existing tests, example checks passed.

</details>
