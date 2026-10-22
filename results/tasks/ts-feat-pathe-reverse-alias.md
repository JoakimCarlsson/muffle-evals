# ts-feat-pathe-reverse-alias

Source: https://github.com/unjs/pathe/pull/173

## Prompt

> `pathe/utils` has `resolveAlias(path, aliases)` to turn an aliased path into a real one, but I need the opposite: given a real path, which aliased paths could I write instead? I'm writing lint rules that suggest alias imports.
> 
> Could you add `reverseResolveAlias(path, aliases): string[]` to `pathe/utils` (in `src/utils.ts`, next to `resolveAlias`)?
> 
> - It takes the same alias map as `resolveAlias` and should treat it the same way (normalized with `normalizeAliases`, Windows paths normalized, alias targets only match on a path separator boundary or the whole path, aliases that end in `/` work like they do in `resolveAlias`).
> - It returns every aliased form of the path, sorted longest first. No match returns `[]`.
> 
> Examples:
> 
> ```ts
> reverseResolveAlias("/root/some/assets/smth.jpg", { "~": "/root", "~assets": "/root/some/assets" });
> // => ["~/some/assets/smth.jpg", "~assets/smth.jpg"]
> 
> reverseResolveAlias("/root/index.js", { "@": "/root", "~": "/root/index.js" });
> // => ["@/index.js", "~"]
> 
> reverseResolveAlias("/src/foo/bar", { "~/": "/src" });
> // => ["~/foo/bar"]
> 
> reverseResolveAlias("/src", { "~/": "/src" });
> // => ["~/"]
> 
> reverseResolveAlias("./bar.js", { "@": "/root" });
> // => []
> ```
> 
> Please add this.

## Upstream change (tests left out)

Files: [README.md](../../tasks/ts-feat-pathe-reverse-alias/upstream/README.md), [src/utils.ts](../../tasks/ts-feat-pathe-reverse-alias/upstream/src/utils.ts), [test/utils.spec.ts](../../tasks/ts-feat-pathe-reverse-alias/upstream/test/utils.spec.ts)

```diff
diff --git a/README.md b/README.md
index e371656..0575b62 100644
--- a/README.md
+++ b/README.md
@@ -46,7 +46,7 @@ Pathe exports some extra utilities that do not exist in standard Node.js [path m
 In order to use them, you can import from `pathe/utils` subpath:
 
 ```js
-import { filename, normalizeAliases, resolveAlias } from 'pathe/utils'
+import { filename, normalizeAliases, resolveAlias, reverseResolveAlias } from 'pathe/utils'
 ```
 
 ## License
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..300df7e 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,37 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Resolves a path string to its possible alias.
+ *
+ * Returns an array of possible alias resolutions (could be empty), sorted by specificity (longest first).
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  aliases = normalizeAliases(aliases);
+
+  const matches: string[] = [];
+
+  for (const [to, alias] of Object.entries(aliases)) {
+    if (!_path.startsWith(alias)) {
+      continue;
+    }
+
+    // Strip trailing slash from alias for check
+    const _alias = hasTrailingSlash(alias) ? alias.slice(0, -1) : alias;
+
+    if (hasTrailingSlash(_path[_alias.length])) {
+      matches.push(join(to, _path.slice(alias.length)));
+    }
+  }
+
+  // Sort by length, longest (more specific) first
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +36/-1 | 35 | 3,489 | $0.115 |
| claude | muffle | pass | +38/-1 | 40 | 3,117 | $0.099 |
| claude | hush | pass | +38/-1 | 38 | 2,592 | $0.090 |
| claude | sloth | pass | +30/-1 | 0 | 2,708 | $0.085 |
| claude | all | pass | +29/-0 | 0 | 2,566 | $0.089 |
| codex | base | pass | +23/-0 | 52 | 1,765 | - |
| codex | muffle | pass | +34/-0 | 56 | 1,734 | - |
| codex | hush | pass | +31/-0 | 48 | 1,624 | - |
| codex | sloth | pass | +34/-0 | 0 | 2,100 | - |
| codex | all | pass | +23/-0 | 0 | 1,208 | - |

### claude, base: pass

Files: [README.md](../base/claude/ts-feat-pathe-reverse-alias-1/files/README.md), [src/utils.ts](../base/claude/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../base/claude/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index e371656..0575b62 100644
--- a/README.md
+++ b/README.md
@@ -46,7 +46,7 @@ Pathe exports some extra utilities that do not exist in standard Node.js [path m
 In order to use them, you can import from `pathe/utils` subpath:
 
 ```js
-import { filename, normalizeAliases, resolveAlias } from 'pathe/utils'
+import { filename, normalizeAliases, resolveAlias, reverseResolveAlias } from 'pathe/utils'
 ```
 
 ## License
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..415fdc6 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,41 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Finds every aliased form of a path, i.e. the reverse of `resolveAlias`.
+ * A target only matches on a path separator boundary or the whole path.
+ *
+ * @param path - The path string to find aliased forms of.
+ * @param aliases - A set of alias mappings to use for the lookup.
+ * @returns the aliased paths, longest first, or an empty array if none match.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  aliases = normalizeAliases(aliases);
+  const matches = new Set<string>();
+  for (const [alias, target] of Object.entries(aliases)) {
+    let to = normalizeWindowsPath(target);
+    if (hasTrailingSlash(to)) {
+      to = to.slice(0, -1);
+    }
+
+    if (!_path.startsWith(to)) {
+      continue;
+    }
+
+    const rest = _path.slice(to.length);
+    if (rest === "") {
+      matches.add(alias);
+    } else if (rest[0] === "/") {
+      matches.add(alias + (hasTrailingSlash(alias) ? rest.slice(1) : rest));
+    }
+  }
+  return [...matches].sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..f0d4def 100644
--- a/test/utils.spec.ts
+++ b/test/utils.spec.ts
@@ -1,6 +1,11 @@
 import { describe, expect, it } from "vitest";
 
-import { normalizeAliases, filename, resolveAlias } from "../src/utils";
+import {
+  normalizeAliases,
+  filename,
+  resolveAlias,
+  reverseResolveAlias,
+} from "../src/utils";
 
 describe("alias", () => {
   const _aliases = {
@@ -56,6 +61,35 @@ describe("alias", () => {
       expect(resolveAlias("~win/foo/bar", aliases)).toBe("C:/src/foo/bar");
     });
   });
+
+  describe("reverseResolveAlias", () => {
+    it("respects path separators", () => {
+      const aliases = { "~": "/root", "~assets": "/root/some/assets" };
+      expect(
+        reverseResolveAlias("/root/some/assets/smth.jpg", aliases),
+      ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
+      expect(reverseResolveAlias("/rootless/a.js", aliases)).toEqual([]);
+    });
+    it("matches the whole path", () => {
+      expect(
+        reverseResolveAlias("/root/index.js", { "@": "/root", "~": "/root/index.js" }),
+      ).toEqual(["@/index.js", "~"]);
+    });
+    it("respect ending with /", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+    });
+    it("normalizes windows paths", () => {
+      expect(
+        reverseResolveAlias("C:\\src\\foo", { "~win/": "C:/src" }),
+      ).toEqual(["~win/foo"]);
+    });
+    it("unchanged", () => {
+      expect(reverseResolveAlias("./bar.js", { "@": "/root" })).toEqual([]);
+    });
+  });
 });
 
 describe("filename", () => {
```

</details>

<details><summary>reply</summary>

I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`. The utils tests pass (37), including your five examples and a case with a Windows path. `tsc --noEmit` is clean.

It follows the rules you listed:
- **Alias map and path:** it runs the aliases through `normalizeAliases` and normalizes the path, and alias targets, as Windows paths first.
- **Matching:** a target matches only when it equals the whole path or ends at a `/`. So `/rootless/a.js` doesn't match `"~": "/root"`.
- **Trailing `/`:** aliases that end in `/` work like they do in `resolveAlias`. `/src/foo/bar` with `"~/": "/src"` gives `~/foo/bar`, and `/src` gives `~/`.
- **Results:** it removes duplicates, sorts longest first, and returns `[]` when nothing matches.

I also added tests in `test/utils.spec.ts` and put `reverseResolveAlias` in the README's `pathe/utils` import example. I didn't commit anything.

</details>

### claude, muffle: pass

Files: [README.md](../muffle/claude/ts-feat-pathe-reverse-alias-1/files/README.md), [src/utils.ts](../muffle/claude/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../muffle/claude/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index e371656..0575b62 100644
--- a/README.md
+++ b/README.md
@@ -46,7 +46,7 @@ Pathe exports some extra utilities that do not exist in standard Node.js [path m
 In order to use them, you can import from `pathe/utils` subpath:
 
 ```js
-import { filename, normalizeAliases, resolveAlias } from 'pathe/utils'
+import { filename, normalizeAliases, resolveAlias, reverseResolveAlias } from 'pathe/utils'
 ```
 
 ## License
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..2dfde44 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,43 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Finds every aliased form of a path, the reverse of `resolveAlias`.
+ * An alias target only matches on a path separator boundary or the whole path.
+ *
+ * @param path - The real path to find aliased forms of.
+ * @param aliases - A set of alias mappings to use.
+ * @returns the matching aliased paths, longest first, or an empty array if none match.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  aliases = normalizeAliases(aliases);
+  const matches: string[] = [];
+  for (const [alias, to] of Object.entries(aliases)) {
+    let _to = normalizeWindowsPath(to);
+    if (hasTrailingSlash(_to)) {
+      _to = _to.slice(0, -1);
+    }
+
+    if (!_path.startsWith(_to)) {
+      continue;
+    }
+
+    const rest = _path.slice(_to.length);
+    if (rest !== "" && rest[0] !== "/") {
+      continue;
+    }
+
+    matches.push(
+      hasTrailingSlash(alias) ? alias + rest.replace(/^\/+/, "") : alias + rest,
+    );
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..de4ff5d 100644
--- a/test/utils.spec.ts
+++ b/test/utils.spec.ts
@@ -1,6 +1,11 @@
 import { describe, expect, it } from "vitest";
 
-import { normalizeAliases, filename, resolveAlias } from "../src/utils";
+import {
+  normalizeAliases,
+  filename,
+  resolveAlias,
+  reverseResolveAlias,
+} from "../src/utils";
 
 describe("alias", () => {
   const _aliases = {
@@ -56,6 +61,40 @@ describe("alias", () => {
       expect(resolveAlias("~win/foo/bar", aliases)).toBe("C:/src/foo/bar");
     });
   });
+
+  describe("reverseResolveAlias", () => {
+    it("respects path separators, longest first", () => {
+      expect(
+        reverseResolveAlias("/root/some/assets/smth.jpg", {
+          "~": "/root",
+          "~assets": "/root/some/assets",
+        }),
+      ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
+      expect(
+        reverseResolveAlias("/root/index.js", {
+          "@": "/root",
+          "~": "/root/index.js",
+        }),
+      ).toEqual(["@/index.js", "~"]);
+      expect(reverseResolveAlias("/rootless/a.js", { "@": "/root" })).toEqual(
+        [],
+      );
+    });
+    it("unchanged", () => {
+      expect(reverseResolveAlias("./bar.js", { "@": "/root" })).toEqual([]);
+    });
+    it("respect ending with /", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+    });
+    it("normalizes windows paths", () => {
+      expect(
+        reverseResolveAlias("C:\\src\\foo", { "~win/": "C:/src" }),
+      ).toEqual(["~win/foo"]);
+    });
+  });
 });
 
 describe("filename", () => {
```

</details>

<details><summary>reply</summary>

I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`. The vitest suite for `test/utils.spec.ts` passes, including your examples. I couldn't type-check, because `npx tsc --noEmit` only printed an npm notice and no result. I haven't committed anything.

- **Matching:** It normalizes the path with `normalizeWindowsPath` and the aliases with `normalizeAliases`, and it also normalizes each alias target. A target matches only if it equals the whole path or ends at a `/` boundary, so `/rootless/a.js` doesn't match `@: /root`.
- **Trailing `/`:** An alias ending in `/` joins the rest of the path without doubling the slash. `/src/foo/bar` gives `~/foo/bar` and `/src` gives `~/`.
- **Result:** Matches are sorted longest first, and no match gives `[]`.

I added tests for your five examples, the `/rootless` boundary case and a Windows path (`C:\src\foo` → `~win/foo`). I also added `reverseResolveAlias` to the import line in the README's "Extra utilities" section.

</details>

### claude, hush: pass

Files: [README.md](../hush/claude/ts-feat-pathe-reverse-alias-1/files/README.md), [src/utils.ts](../hush/claude/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../hush/claude/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index e371656..0575b62 100644
--- a/README.md
+++ b/README.md
@@ -46,7 +46,7 @@ Pathe exports some extra utilities that do not exist in standard Node.js [path m
 In order to use them, you can import from `pathe/utils` subpath:
 
 ```js
-import { filename, normalizeAliases, resolveAlias } from 'pathe/utils'
+import { filename, normalizeAliases, resolveAlias, reverseResolveAlias } from 'pathe/utils'
 ```
 
 ## License
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..4c74f0b 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,43 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Finds every aliased form of a path, the reverse of `resolveAlias`.
+ * An alias only matches if its target is the whole path or ends on a path separator boundary.
+ *
+ * @param path - The path string to find aliases for.
+ * @param aliases - A set of alias mappings to use for lookup.
+ * @returns the aliased paths, sorted longest first, or an empty array if no alias matches.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  aliases = normalizeAliases(aliases);
+
+  const matches = new Set<string>();
+  for (const [alias, to] of Object.entries(aliases)) {
+    const _to = normalizeWindowsPath(to).replace(/\/+$/, "");
+    if (!_path.startsWith(_to)) {
+      continue;
+    }
+
+    const rest = _path.slice(_to.length);
+    if (rest && rest[0] !== "/") {
+      continue;
+    }
+
+    matches.add(
+      hasTrailingSlash(alias)
+        ? alias.replace(/[/\\]+$/, "/") + rest.replace(/^\/+/, "")
+        : alias + rest,
+    );
+  }
+
+  return [...matches].sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..fdc60e9 100644
--- a/test/utils.spec.ts
+++ b/test/utils.spec.ts
@@ -1,6 +1,11 @@
 import { describe, expect, it } from "vitest";
 
-import { normalizeAliases, filename, resolveAlias } from "../src/utils";
+import {
+  normalizeAliases,
+  filename,
+  resolveAlias,
+  reverseResolveAlias,
+} from "../src/utils";
 
 describe("alias", () => {
   const _aliases = {
@@ -56,6 +61,38 @@ describe("alias", () => {
       expect(resolveAlias("~win/foo/bar", aliases)).toBe("C:/src/foo/bar");
     });
   });
+
+  describe("reverseResolveAlias", () => {
+    it("returns all matches, longest first", () => {
+      expect(
+        reverseResolveAlias("/root/some/assets/smth.jpg", {
+          "~": "/root",
+          "~assets": "/root/some/assets",
+        }),
+      ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
+      expect(
+        reverseResolveAlias("/root/index.js", {
+          "@": "/root",
+          "~": "/root/index.js",
+        }),
+      ).toEqual(["@/index.js", "~"]);
+    });
+    it("respects path separators", () => {
+      expect(reverseResolveAlias("/rootless/a", { "~": "/root" })).toEqual([]);
+    });
+    it("respect ending with /", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+      expect(
+        reverseResolveAlias("C:\\src\\foo", { "~win/": "C:/src" }),
+      ).toEqual(["~win/foo"]);
+    });
+    it("unchanged", () => {
+      expect(reverseResolveAlias("./bar.js", { "@": "/root" })).toEqual([]);
+    });
+  });
 });
 
 describe("filename", () => {
```

</details>

<details><summary>reply</summary>

Done. `reverseResolveAlias` added in `src/utils.ts`, with tests and a README import update. Vitest passes. `tsc` printed an npx notice instead of type-check output, so types are unchecked. Nothing committed.

</details>

### claude, sloth: pass

Files: [README.md](../sloth/claude/ts-feat-pathe-reverse-alias-1/files/README.md), [src/utils.ts](../sloth/claude/ts-feat-pathe-reverse-alias-1/files/src/utils.ts)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index e371656..0575b62 100644
--- a/README.md
+++ b/README.md
@@ -46,7 +46,7 @@ Pathe exports some extra utilities that do not exist in standard Node.js [path m
 In order to use them, you can import from `pathe/utils` subpath:
 
 ```js
-import { filename, normalizeAliases, resolveAlias } from 'pathe/utils'
+import { filename, normalizeAliases, resolveAlias, reverseResolveAlias } from 'pathe/utils'
 ```
 
 ## License
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..511945f 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,35 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Finds every aliased form of a path, the reverse of `resolveAlias`.
+ *
+ * @param path - The real path to find aliased forms of.
+ * @param aliases - A set of alias mappings to use for matching.
+ * @returns the aliased paths sorted longest first, or an empty array if no alias matches.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  const matches: string[] = [];
+  for (const [alias, target] of Object.entries(normalizeAliases(aliases))) {
+    const _target = normalizeWindowsPath(target);
+    const to = hasTrailingSlash(_target) ? _target.slice(0, -1) : _target;
+    if (!_path.startsWith(to)) {
+      continue;
+    }
+    const rest = _path.slice(to.length);
+    if (rest === "") {
+      matches.push(alias);
+    } else if (hasTrailingSlash(rest[0])) {
+      matches.push((hasTrailingSlash(alias) ? alias.slice(0, -1) : alias) + rest);
+    }
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
```

</details>

<details><summary>reply</summary>

I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`, and added it to the import line in the README.

It handles the alias map the way `resolveAlias` does:
- **Normalization:** it runs the map through `normalizeAliases` and normalizes Windows paths.
- **Matching:** a target only matches on a separator boundary or the whole path, so `/rootx/a` doesn't match `/root`.
- **Trailing slash:** it handles aliases ending in `/`. A path equal to the target returns the alias as written, so `~/` gives `~/` and `~` gives `~`.
- **Order:** results are sorted longest first, and no match returns `[]`.

I ran all five of your examples, plus the `/rootx/a` boundary case, in a throwaway spec, and they all pass. I deleted that spec afterwards, and I didn't add permanent tests since you didn't ask for any. The existing suite (362 tests), `eslint` and `tsc --noEmit` all pass.

I haven't committed anything.

</details>

### claude, all: pass

Files: [src/utils.ts](../all/claude/ts-feat-pathe-reverse-alias-1/files/src/utils.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..ef01eea 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,35 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Finds every aliased form of a real path, the opposite of `resolveAlias`.
+ *
+ * @param path - The real path to express through aliases.
+ * @param aliases - A set of alias mappings to use for matching.
+ * @returns the aliased paths sorted longest first, or an empty array if no alias matches.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  aliases = normalizeAliases(aliases);
+  const matches: string[] = [];
+  for (const [alias, to] of Object.entries(aliases)) {
+    const _to = normalizeWindowsPath(to).replace(/\/+$/, "");
+    if (!_path.startsWith(_to) || !pathSeparators.has(_path[_to.length])) {
+      continue;
+    }
+    const rest = _path.slice(_to.length);
+    matches.push(
+      hasTrailingSlash(alias)
+        ? alias + rest.slice(1)
+        : alias + rest,
+    );
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
```

</details>

<details><summary>reply</summary>

Done. `reverseResolveAlias` added in `src/utils.ts` after `resolveAlias`. All five of your examples pass in a throwaway test, which I deleted. The existing tests, eslint and tsc are clean. I added no permanent tests or README entry.

</details>

### codex, base: pass

Files: [src/utils.ts](../base/codex/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../base/codex/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..4fa376b 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,29 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Returns every aliased form of a path, sorted from longest to shortest.
+ *
+ * @param path - The path string to reverse resolve.
+ * @param aliases - A set of alias mappings to use for resolution.
+ * @returns the matching aliased paths.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  const matches: string[] = [];
+  for (const [alias, to] of Object.entries(normalizeAliases(aliases))) {
+    const target = normalizeWindowsPath(to).replace(/\/+$/, "");
+    if (_path.startsWith(target) && pathSeparators.has(_path[target.length])) {
+      const suffix = _path.slice(target.length);
+      matches.push(suffix ? join(alias, suffix) : alias);
+    }
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..754e13b 100644
--- a/test/utils.spec.ts
+++ b/test/utils.spec.ts
@@ -1,6 +1,11 @@
 import { describe, expect, it } from "vitest";
 
-import { normalizeAliases, filename, resolveAlias } from "../src/utils";
+import {
+  normalizeAliases,
+  filename,
+  resolveAlias,
+  reverseResolveAlias,
+} from "../src/utils";
 
 describe("alias", () => {
   const _aliases = {
@@ -32,6 +37,52 @@ describe("alias", () => {
     `);
   });
 
+  describe("reverseResolveAlias", () => {
+    it("returns all matches sorted longest first", () => {
+      expect(
+        reverseResolveAlias("/root/some/assets/smth.jpg", {
+          "~": "/root",
+          "~assets": "/root/some/assets",
+        }),
+      ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
+      expect(reverseResolveAlias("/root/index.js", aliases)).toEqual([
+        "@/index.js",
+        "~",
+      ]);
+    });
+    it("normalizes aliases before matching", () => {
+      expect(reverseResolveAlias("/root/bingpot/index.ts", _aliases)).toEqual([
+        "@/bingpot/index.ts",
+        "bingpot",
+      ]);
+    });
+    it("respects path boundaries and unmatched paths", () => {
+      for (const path of ["/rooted/foo", "./bar.js", "/other"]) {
+        expect(reverseResolveAlias(path, { "@": "/root" })).toEqual([]);
+      }
+    });
+    it("preserves aliases ending with a slash", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+    });
+    it("handles targets ending with a slash", () => {
+      expect(reverseResolveAlias("/src/foo", { "@": "/src/" })).toEqual([
+        "@/foo",
+      ]);
+      expect(reverseResolveAlias("/src", { "@": "/src/" })).toEqual(["@"]);
+      expect(reverseResolveAlias("/foo", { "@": "/" })).toEqual(["@/foo"]);
+    });
+    it("normalizes Windows paths and targets", () => {
+      expect(
+        reverseResolveAlias(String.raw`C:\src\foo\bar`, {
+          "~/": String.raw`C:\src`,
+        }),
+      ).toEqual(["~/foo/bar"]);
+    });
+  });
+
   describe("resolveAlias", () => {
     for (const [from, to] of Object.entries(aliases)) {
       it(from, () => {
```

</details>

<details><summary>reply</summary>

I’ll check how `resolveAlias` handles normalization, add the reverse helper alongside it, and run the relevant tests.

Added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, exported through `pathe/utils`.

It normalizes aliases and Windows paths, matches target boundaries, preserves trailing-slash aliases, and sorts results longest first.

All 368 tests pass, along with lint, formatting, type checks, and build.

</details>

### codex, muffle: pass

Files: [src/utils.ts](../muffle/codex/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../muffle/codex/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..bad7a9f 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,40 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Returns every aliased form of a path, sorted from longest to shortest.
+ *
+ * @param path - The path string to reverse resolve.
+ * @param aliases - A set of alias mappings to use for resolution.
+ * @returns the matching aliased paths.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  const matches: string[] = [];
+
+  for (const [alias, target] of Object.entries(normalizeAliases(aliases))) {
+    const to = normalizeWindowsPath(target);
+    if (
+      !_path.startsWith(to) ||
+      (!hasTrailingSlash(to) && !pathSeparators.has(_path[to.length]))
+    ) {
+      continue;
+    }
+
+    const suffix = _path.slice(to.length);
+    matches.push(
+      suffix
+        ? alias.replace(/[/\\]$/, "") + "/" + suffix.replace(/^\//, "")
+        : alias,
+    );
+  }
+
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..1af822b 100644
--- a/test/utils.spec.ts
+++ b/test/utils.spec.ts
@@ -1,6 +1,11 @@
 import { describe, expect, it } from "vitest";
 
-import { normalizeAliases, filename, resolveAlias } from "../src/utils";
+import {
+  normalizeAliases,
+  filename,
+  resolveAlias,
+  reverseResolveAlias,
+} from "../src/utils";
 
 describe("alias", () => {
   const _aliases = {
@@ -56,6 +61,56 @@ describe("alias", () => {
       expect(resolveAlias("~win/foo/bar", aliases)).toBe("C:/src/foo/bar");
     });
   });
+
+  describe("reverseResolveAlias", () => {
+    it("returns all matches, longest first", () => {
+      expect(
+        reverseResolveAlias("/root/some/assets/smth.jpg", {
+          "~": "/root",
+          "~assets": "/root/some/assets",
+        }),
+      ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
+      expect(reverseResolveAlias("/root/index.js", aliases)).toEqual([
+        "@/index.js",
+        "~",
+      ]);
+    });
+
+    it("preserves aliases ending in a slash", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+    });
+
+    it("normalizes alias mappings", () => {
+      expect(reverseResolveAlias("/root/bingpot/index.ts", _aliases)).toEqual([
+        "@/bingpot/index.ts",
+        "bingpot",
+      ]);
+    });
+
+    it("normalizes Windows paths and targets", () => {
+      expect(
+        reverseResolveAlias(String.raw`C:\src\foo\bar`, {
+          "~/": String.raw`C:\src`,
+        }),
+      ).toEqual(["~/foo/bar"]);
+    });
+
+    it("respects target boundaries", () => {
+      expect(reverseResolveAlias("/rooted/file", { "@": "/root" })).toEqual([]);
+      expect(reverseResolveAlias("./bar.js", aliases)).toEqual([]);
+      expect(reverseResolveAlias("/root/file", {})).toEqual([]);
+    });
+
+    it("handles targets ending in a slash", () => {
+      expect(reverseResolveAlias("/src/foo", { "@": "/src/" })).toEqual([
+        "@/foo",
+      ]);
+      expect(reverseResolveAlias("/foo", { "@": "/" })).toEqual(["@/foo"]);
+    });
+  });
 });
 
 describe("filename", () => {
```

</details>

<details><summary>reply</summary>

I’ll check the existing alias handling, add the reverse helper, and test the boundary and trailing-slash cases.

Added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, exported through `pathe/utils`.

It normalizes aliases and Windows paths, respects target boundaries and trailing slashes, and returns matches longest first.

Validation passed: 368 tests, lint, type checking, and build.

</details>

### codex, hush: pass

Files: [src/utils.ts](../hush/codex/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../hush/codex/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..5aefef7 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,37 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Returns all alias forms of a path, sorted from longest to shortest.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  aliases = normalizeAliases(aliases);
+  const matches: string[] = [];
+
+  for (const [alias, to] of Object.entries(aliases)) {
+    const target = normalizeWindowsPath(to).replace(/\/+$/, "");
+    if (
+      !_path.startsWith(target) ||
+      !pathSeparators.has(_path[target.length])
+    ) {
+      continue;
+    }
+
+    const suffix = _path.slice(target.length);
+    matches.push(
+      suffix && hasTrailingSlash(alias)
+        ? alias + suffix.slice(1)
+        : alias + suffix,
+    );
+  }
+
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..4a5a831 100644
--- a/test/utils.spec.ts
+++ b/test/utils.spec.ts
@@ -1,6 +1,11 @@
 import { describe, expect, it } from "vitest";
 
-import { normalizeAliases, filename, resolveAlias } from "../src/utils";
+import {
+  normalizeAliases,
+  filename,
+  resolveAlias,
+  reverseResolveAlias,
+} from "../src/utils";
 
 describe("alias", () => {
   const _aliases = {
@@ -32,6 +37,48 @@ describe("alias", () => {
     `);
   });
 
+  describe("reverseResolveAlias", () => {
+    it("returns every match sorted by output length", () => {
+      expect(
+        reverseResolveAlias("/root/some/assets/smth.jpg", {
+          "~": "/root",
+          "~assets": "/root/some/assets",
+        }),
+      ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
+      expect(reverseResolveAlias("/root/index.js", aliases)).toEqual([
+        "@/index.js",
+        "~",
+      ]);
+    });
+    it("respects whole targets and separator boundaries", () => {
+      expect(reverseResolveAlias("/rooted/foo", aliases)).toEqual([]);
+      expect(reverseResolveAlias("./bar.js", aliases)).toEqual([]);
+      expect(reverseResolveAlias("/root", {})).toEqual([]);
+    });
+    it("preserves aliases ending in a slash", () => {
+      expect(reverseResolveAlias("/src/foo/bar", aliases)).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", aliases)).toEqual(["~/"]);
+    });
+    it("normalizes aliases and Windows paths", () => {
+      expect(reverseResolveAlias("/root/bingpot/index.ts", _aliases)).toEqual([
+        "@/bingpot/index.ts",
+        "bingpot",
+      ]);
+      expect(
+        reverseResolveAlias(String.raw`C:\src\foo`, {
+          "~/": String.raw`C:\src`,
+        }),
+      ).toEqual(["~/foo"]);
+    });
+    it("handles trailing target separators", () => {
+      expect(reverseResolveAlias("/src/foo", { "@": "/src/" })).toEqual([
+        "@/foo",
+      ]);
+    });
+  });
+
   describe("resolveAlias", () => {
     for (const [from, to] of Object.entries(aliases)) {
       it(from, () => {
```

</details>

<details><summary>reply</summary>

Done.
Added `reverseResolveAlias` in `src/utils.ts` with normalization, boundary matching, trailing-slash support, longest-first sorting. All 367 tests, lint, type checks passed.

</details>

### codex, sloth: pass

Files: [src/utils.ts](../sloth/codex/ts-feat-pathe-reverse-alias-1/files/src/utils.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..0f1231c 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,40 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Returns every aliased form of a path, sorted from longest to shortest.
+ *
+ * @param path - The path string to reverse resolve.
+ * @param aliases - A set of alias mappings to use for resolution.
+ * @returns the matching aliased paths.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  const matches: string[] = [];
+  for (const [alias, to] of Object.entries(normalizeAliases(aliases))) {
+    const target = normalizeWindowsPath(to).replace(/(.)\/+$/, "$1");
+    if (
+      !_path.startsWith(target) ||
+      (!target.endsWith("/") && !pathSeparators.has(_path[target.length]))
+    ) {
+      continue;
+    }
+
+    const remainder = _path.slice(target.length);
+    const suffix =
+      remainder && target.endsWith("/") ? "/" + remainder : remainder;
+    matches.push(
+      hasTrailingSlash(alias) && suffix.startsWith("/")
+        ? alias + suffix.slice(1)
+        : alias + suffix,
+    );
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
```

</details>

<details><summary>reply</summary>

I’ll check alias normalization and exports, add the helper beside `resolveAlias`, then run the build and existing tests.

This only needs a change in `src/utils.ts`: the existing exports will expose the helper and its types. I’ll reuse `normalizeAliases`, normalize Windows paths on both sides, preserve aliases ending in `/`, and sort results by string length. No new options or dependencies are needed.

Added `reverseResolveAlias(path, aliases): string[]` in `src/utils.ts`, exported through `pathe/utils`.

It reuses alias normalization, handles Windows paths and trailing slashes, matches separator boundaries, and sorts results longest first.

Build, lint, type checks, all 362 existing tests, and direct checks of your examples passed.

</details>

### codex, all: pass

Files: [src/utils.ts](../all/codex/ts-feat-pathe-reverse-alias-1/files/src/utils.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..6729351 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,29 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Returns every aliased form of a path, sorted from longest to shortest.
+ *
+ * @param path - The path string to resolve back to aliases.
+ * @param aliases - A set of alias mappings to use for resolution.
+ * @returns the matching aliased paths.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  const paths: string[] = [];
+  for (const [alias, to] of Object.entries(normalizeAliases(aliases))) {
+    const target = normalizeWindowsPath(to).replace(/\/$/, "");
+    if (_path.startsWith(target) && pathSeparators.has(_path[target.length])) {
+      const suffix = _path.slice(target.length);
+      paths.push(alias + (hasTrailingSlash(alias) ? suffix.slice(1) : suffix));
+    }
+  }
+  return paths.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
```

</details>

<details><summary>reply</summary>

Adding `reverseResolveAlias` beside `resolveAlias`; checking normalization, exports, existing tests, and build.


Done.
Added `reverseResolveAlias` in `src/utils.ts`. Normalization, boundaries, trailing slashes, longest-first sorting handled. Build, lint, types, 362 existing tests, example checks passed.

</details>
