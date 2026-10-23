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
| claude | muffle | pass | +32/-1 | 35 | 3,470 | $0.102 |
| claude | hush | pass | +37/-1 | 28 | 2,361 | $0.082 |
| claude | sloth | pass | +25/-0 | 38 | 3,563 | $0.111 |
| claude | all | pass | +31/-0 | 36 | 2,859 | $0.086 |
| codex | base | pass | +23/-0 | 52 | 1,765 | - |
| codex | muffle | pass | +34/-0 | 48 | 1,692 | - |
| codex | hush | pass | +25/-0 | 37 | 1,548 | - |
| codex | sloth | pass | +28/-0 | 35 | 1,916 | - |
| codex | all | pass | +29/-1 | 43 | 1,926 | - |

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
index 6ec11c1..c114cce 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,37 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Finds every aliased form of a path, the reverse of {@link resolveAlias}.
+ * Alias targets only match on a path separator boundary or the whole path.
+ *
+ * @param path - The real path to find aliases for.
+ * @param aliases - A set of alias mappings to use for resolution.
+ * @returns the aliased paths, sorted longest first, or an empty array if none match.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  aliases = normalizeAliases(aliases);
+  const matches = new Set<string>();
+  for (const [alias, target] of Object.entries(aliases)) {
+    const to = normalizeWindowsPath(target);
+    // Strip trailing slash from target for the boundary check
+    const _to = hasTrailingSlash(to) ? to.slice(0, -1) : to;
+
+    if (_path === to || _path === _to) {
+      matches.add(alias);
+    } else if (_path.startsWith(_to) && hasTrailingSlash(_path[_to.length])) {
+      // Strip trailing slash from alias, the remainder starts with one
+      const _alias = hasTrailingSlash(alias) ? alias.slice(0, -1) : alias;
+      matches.add(_alias + _path.slice(_to.length));
+    }
+  }
+  return [...matches].sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..e888e46 100644
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
+    it("returns all aliases, longest first", () => {
+      expect(
+        reverseResolveAlias("/root/some/assets/smth.jpg", {
+          "~": "/root",
+          "~assets": "/root/some/assets",
+        }),
+      ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
+      expect(
+        reverseResolveAlias("/root/index.js", { "@": "/root", "~": "/root/index.js" }),
+      ).toEqual(["@/index.js", "~"]);
+    });
+    it("respects path separators", () => {
+      expect(reverseResolveAlias("/rootfoo/a.js", { "@": "/root" })).toEqual([]);
+    });
+    it("respect ending with /", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+      expect(reverseResolveAlias("C:\\src\\foo", aliases)).toEqual([
+        "~win/foo",
+      ]);
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

I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`. The tests in `test/utils.spec.ts` pass (36 of 36), and `tsc --noEmit` reports no errors.

It runs the aliases through `normalizeAliases` and normalizes Windows paths, as `resolveAlias` does. It then collects each aliased form, dropping duplicates, and sorts them longest first. It returns `[]` when nothing matches.

- **Separator boundary:** A target only matches the whole path or a prefix that ends on a path separator. `/rootfoo/a.js` does not match `"@": "/root"`.
- **Trailing `/` aliases:**
  - `{ "~/": "/src" }` turns `/src/foo/bar` into `~/foo/bar`.
  - It turns the bare `/src` into `~/`.
  - A Windows path like `C:\src\foo` works against the existing test aliases and gives `~win/foo`.

I added tests covering all five of your examples plus the separator-boundary and Windows cases. I also added `reverseResolveAlias` to the `pathe/utils` import line in the README. Nothing is committed.

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
index 6ec11c1..6e54ae9 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,42 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Finds every aliased form of a real path, the opposite of `resolveAlias`.
+ * Aliases only match on a path separator boundary or the whole path.
+ *
+ * @param path - The real path to find aliased forms of.
+ * @param aliases - A set of alias mappings to use for lookup.
+ * @returns the aliased paths, sorted longest first. Empty if no alias matches.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  aliases = normalizeAliases(aliases);
+  const matches = new Set<string>();
+  for (const [alias, to] of Object.entries(aliases)) {
+    let base = normalizeWindowsPath(to);
+    while (hasTrailingSlash(base) && base.length > 0) {
+      base = base.slice(0, -1);
+    }
+    if (!_path.startsWith(base)) {
+      continue;
+    }
+    const rest = _path.slice(base.length);
+    if (rest !== "" && !hasTrailingSlash(rest[0])) {
+      continue;
+    }
+    if (hasTrailingSlash(alias)) {
+      matches.add(alias + rest.slice(1));
+    } else {
+      matches.add(alias + rest);
+    }
+  }
+  return [...matches].sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..02dbb33 100644
--- a/test/utils.spec.ts
+++ b/test/utils.spec.ts
@@ -1,6 +1,6 @@
 import { describe, expect, it } from "vitest";
 
-import { normalizeAliases, filename, resolveAlias } from "../src/utils";
+import { normalizeAliases, filename, resolveAlias, reverseResolveAlias } from "../src/utils";
 
 describe("alias", () => {
   const _aliases = {
@@ -32,6 +32,33 @@ describe("alias", () => {
     `);
   });
 
+  describe("reverseResolveAlias", () => {
+    it("returns all aliased forms, longest first", () => {
+      expect(
+        reverseResolveAlias("/root/some/assets/smth.jpg", {
+          "~": "/root",
+          "~assets": "/root/some/assets",
+        }),
+      ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
+      expect(
+        reverseResolveAlias("/root/index.js", { "@": "/root", "~": "/root/index.js" }),
+      ).toEqual(["@/index.js", "~"]);
+    });
+    it("handles trailing slash aliases", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual(["~/foo/bar"]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+    });
+    it("matches only on separator boundaries", () => {
+      expect(reverseResolveAlias("/rootless/a", { "@": "/root" })).toEqual([]);
+    });
+    it("normalizes windows paths", () => {
+      expect(reverseResolveAlias("C:\\src\\foo", { "~": "C:/src" })).toEqual(["~/foo"]);
+    });
+    it("returns [] without match", () => {
+      expect(reverseResolveAlias("./bar.js", { "@": "/root" })).toEqual([]);
+    });
+  });
+
   describe("resolveAlias", () => {
     for (const [from, to] of Object.entries(aliases)) {
       it(from, () => {
```

</details>

<details><summary>reply</summary>

Done. Added `reverseResolveAlias` in `src/utils.ts`, plus tests for your five examples and edge cases, and a README import update. Tests and `tsc` pass. Nothing committed.

</details>

### claude, sloth: pass

Files: [src/utils.ts](../sloth/claude/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../sloth/claude/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..d348e32 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,31 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Finds every aliased form of a real path, the reverse of `resolveAlias`.
+ *
+ * @param path - The real path string to find aliases for.
+ * @param aliases - A set of alias mappings to use for resolution.
+ * @returns the aliased paths, longest first, or an empty array if no alias matches.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  const matches: string[] = [];
+  for (const [alias, target] of Object.entries(normalizeAliases(aliases))) {
+    const _to = normalizeWindowsPath(target).replace(/\/+$/, "");
+    if (_path === _to) {
+      matches.push(alias);
+    } else if (_path.startsWith(_to) && _path[_to.length] === "/") {
+      const _alias = hasTrailingSlash(alias) ? alias.slice(0, -1) : alias;
+      matches.push(_alias + _path.slice(_to.length));
+    }
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..5b8338e 100644
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
+    it("returns every alias longest first", () => {
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
+    it("matches on separator boundaries only", () => {
+      expect(reverseResolveAlias("/rootfoo/a", { "@": "/root" })).toEqual([]);
+    });
+    it("respect ending with /", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+      expect(
+        reverseResolveAlias(String.raw`C:\src\foo`, { "~win/": "C:/src" }),
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

Fixing a lint error in my new test, then I'll re-run the checks.

I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`. ESLint, `tsc --noEmit` and the full test suite (366 tests) pass. I didn't commit anything.

- **Alias handling:** It normalizes the aliases with `normalizeAliases` and the path with `normalizeWindowsPath`, and it normalizes each alias target the same way.
- **Matching:** A target matches only when it equals the whole path or ends at a `/` boundary. So `/rootfoo/a` does not match `@: /root`.
- **Trailing-slash aliases:** For an alias like `~/`, `/src/foo/bar` gives `~/foo/bar` and `/src` gives `~/`.
- **Output:** Results are sorted longest first, and no match gives `[]`.

I added a `reverseResolveAlias` block to `test/utils.spec.ts`. It covers your five examples, the boundary case above and a Windows path (`C:\src\foo` → `~win/foo`).

</details>

### claude, all: pass

Files: [src/utils.ts](../all/claude/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../all/claude/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..42eebec 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,37 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Finds every aliased form of a path, the reverse of `resolveAlias`.
+ * Aliases only match on a path separator boundary or the whole path.
+ *
+ * @param path - The real path to find aliased forms of.
+ * @param aliases - A set of alias mappings to use for matching.
+ * @returns the aliased paths, longest first, or an empty array if no alias matches.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  aliases = normalizeAliases(aliases);
+  const matches: string[] = [];
+  for (const [alias, to] of Object.entries(aliases)) {
+    const _to = normalizeWindowsPath(to);
+    const target = hasTrailingSlash(_to) ? _to.slice(0, -1) : _to;
+    if (!_path.startsWith(target)) {
+      continue;
+    }
+    const rest = _path.slice(target.length);
+    if (rest && !hasTrailingSlash(rest[0])) {
+      continue;
+    }
+    const _alias = hasTrailingSlash(alias) ? alias.slice(0, -1) : alias;
+    matches.push(rest ? _alias + rest : alias);
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..135b32b 100644
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
@@ -56,6 +61,36 @@ describe("alias", () => {
       expect(resolveAlias("~win/foo/bar", aliases)).toBe("C:/src/foo/bar");
     });
   });
+
+  describe("reverseResolveAlias", () => {
+    it("respects path separators, longest first", () => {
+      const aliases = { "~": "/root", "~assets": "/root/some/assets" };
+      expect(
+        reverseResolveAlias("/root/some/assets/smth.jpg", aliases),
+      ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
+      expect(reverseResolveAlias("/rootless/a.js", aliases)).toEqual([]);
+    });
+    it("matches whole path", () => {
+      expect(
+        reverseResolveAlias("/root/index.js", {
+          "@": "/root",
+          "~": "/root/index.js",
+        }),
+      ).toEqual(["@/index.js", "~"]);
+    });
+    it("respect ending with /", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+      expect(reverseResolveAlias("C:\\src\\foo", aliases)).toEqual([
+        "~win/foo",
+      ]);
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

Done. `reverseResolveAlias` is added in `src/utils.ts` after `resolveAlias`, with tests in `test/utils.spec.ts`. Vitest passes (366 tests), and all your examples are covered. I didn't get a type check: `npx tsc` didn't run. I didn't touch the README.

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
index 6ec11c1..53120c3 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,40 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Returns all aliased forms of a path, sorted from longest to shortest.
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
+  for (const [alias, to] of Object.entries(normalizeAliases(aliases))) {
+    const target = normalizeWindowsPath(to).replace(/\/$/, "");
+    if (
+      !_path.startsWith(target) ||
+      !pathSeparators.has(_path[target.length])
+    ) {
+      continue;
+    }
+
+    const suffix = _path.slice(target.length);
+    matches.push(
+      hasTrailingSlash(alias) && suffix.startsWith("/")
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
index 51ad676..b2b472c 100644
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
+    it("returns every match sorted longest first", () => {
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
+    it("respects target path boundaries", () => {
+      expect(reverseResolveAlias("/rooted/file", { "@": "/root" })).toEqual([]);
+      expect(reverseResolveAlias("./bar.js", aliases)).toEqual([]);
+    });
+
+    it("normalizes aliases and Windows paths", () => {
+      expect(
+        reverseResolveAlias(String.raw`C:\root\foo.js`, {
+          "@": String.raw`C:\root`,
+          "~": "@/foo.js",
+        }),
+      ).toEqual(["@/foo.js", "~"]);
+    });
+
+    it("handles targets ending in a slash", () => {
+      expect(reverseResolveAlias("/src/foo", { "@/": "/src/" })).toEqual([
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

I’ll check the existing alias behavior, add the reverse utility, and run focused tests.

Added `reverseResolveAlias` to `src/utils.ts`, with alias normalization, Windows path support, separator-boundary matching, trailing-slash handling, and longest-first results.

Added regression tests. All 367 tests, TypeScript checks, ESLint, and formatting checks pass.

</details>

### codex, hush: pass

Files: [src/utils.ts](../hush/codex/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../hush/codex/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..f22ab1c 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,31 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Returns every alias form of a path, sorted by descending length.
+ *
+ * @param path - The real path to resolve back to aliases.
+ * @param aliases - The alias mappings used for resolution.
+ * @returns matching aliased paths, or an empty array if none match.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  const matches: string[] = [];
+
+  for (const [alias, to] of Object.entries(normalizeAliases(aliases))) {
+    const target = normalizeWindowsPath(to).replace(/\/$/, "");
+    if (_path.startsWith(target) && pathSeparators.has(_path[target.length])) {
+      const suffix = _path.slice(target.length);
+      matches.push(suffix ? join(alias, suffix) : alias);
+    }
+  }
+
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..dd930cc 100644
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
@@ -32,6 +37,37 @@ describe("alias", () => {
     `);
   });
 
+  describe("reverseResolveAlias", () => {
+    it.each([
+      [
+        "/root/some/assets/smth.jpg",
+        { "~": "/root", "~assets": "/root/some/assets" },
+        ["~/some/assets/smth.jpg", "~assets/smth.jpg"],
+      ],
+      [
+        "/root/index.js",
+        { "@": "/root", "~": "/root/index.js" },
+        ["@/index.js", "~"],
+      ],
+      ["/src/foo/bar", { "~/": "/src" }, ["~/foo/bar"]],
+      ["/src", { "~/": "/src" }, ["~/"]],
+      ["./bar.js", { "@": "/root" }, []],
+      ["/rooted/foo", { "@": "/root" }, []],
+      ["/src/foo", { "@": "/src/" }, ["@/foo"]],
+      ["/foo", { "@": "/" }, ["@/foo"]],
+      [String.raw`c:\src\foo`, { "@": String.raw`C:\src` }, ["@/foo"]],
+      ["/root/lib/foo", { "@": "/root", "~": "@/lib" }, ["@/lib/foo", "~/foo"]],
+    ])("resolves %s", (path, aliases, expected) => {
+      expect(
+        reverseResolveAlias(path, aliases as Record<string, string>),
+      ).toEqual(expected);
+    });
+
+    it("accepts normalized aliases", () => {
+      expect(reverseResolveAlias("/src/foo", aliases)).toEqual(["~/foo"]);
+    });
+  });
+
   describe("resolveAlias", () => {
     for (const [from, to] of Object.entries(aliases)) {
       it(from, () => {
```

</details>

<details><summary>reply</summary>

Reverse alias support needs matching existing normalization and boundary rules.

Done.
Added `reverseResolveAlias` with normalization, boundary matching, trailing slash support, longest-first sorting. All 373 tests, lint, type checks passed.

</details>

### codex, sloth: pass

Files: [src/utils.ts](../sloth/codex/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../sloth/codex/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..6dcc83c 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,34 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Returns every aliased form of a path, sorted from longest to shortest.
+ *
+ * @param path - The real path string to resolve.
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
+    if (
+      !_path.startsWith(target) ||
+      !pathSeparators.has(_path[target.length])
+    ) {
+      continue;
+    }
+
+    const suffix = _path.slice(target.length);
+    matches.push(alias + (hasTrailingSlash(alias) ? suffix.slice(1) : suffix));
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..f0c2a43 100644
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
@@ -32,6 +37,35 @@ describe("alias", () => {
     `);
   });
 
+  it("reverseResolveAlias", () => {
+    expect(
+      reverseResolveAlias("/root/some/assets/smth.jpg", {
+        "~": "/root",
+        "~assets": "/root/some/assets",
+      }),
+    ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
+    expect(reverseResolveAlias("/root/index.js", aliases)).toEqual([
+      "@/index.js",
+      "~",
+    ]);
+    expect(reverseResolveAlias("/src/foo/bar", aliases)).toEqual(["~/foo/bar"]);
+    expect(reverseResolveAlias("/src", aliases)).toEqual(["~/"]);
+    expect(reverseResolveAlias("./bar.js", aliases)).toEqual([]);
+    expect(reverseResolveAlias("/roots/foo", { "@": "/root" })).toEqual([]);
+    expect(reverseResolveAlias("/root/bingpot/index.ts", _aliases)).toEqual([
+      "@/bingpot/index.ts",
+      "bingpot",
+    ]);
+    expect(
+      reverseResolveAlias(String.raw`c:\src\foo`, { "~/": "C:\\src\\" }),
+    ).toEqual(["~/foo"]);
+    expect(reverseResolveAlias("/src/foo", { "@": "/src/" })).toEqual([
+      "@/foo",
+    ]);
+    expect(reverseResolveAlias("", {})).toEqual([]);
+    expect(reverseResolveAlias("/foo", { "@": "/" })).toEqual(["@/foo"]);
+  });
+
   describe("resolveAlias", () => {
     for (const [from, to] of Object.entries(aliases)) {
       it(from, () => {
```

</details>

<details><summary>reply</summary>

I’ll check the alias helpers, exports, and tests, then add the reverse resolver and run the build and test suite.

The change needs to reach `src/utils.ts` and the existing utility tests. The package already exports everything from that file through `pathe/utils`, so no export or config changes are needed. I’ll reuse `normalizeAliases`, normalize Windows paths and targets, and sort the results by string length. Existing resolver behavior will stay unchanged.

Added `reverseResolveAlias(path, aliases): string[]` to `pathe/utils`, with alias normalization, Windows path handling, boundary matching, trailing-slash support, and longest-first sorting.

Validation passed: 363 tests, lint, formatting, TypeScript checks, and build.

</details>

### codex, all: pass

Files: [README.md](../all/codex/ts-feat-pathe-reverse-alias-1/files/README.md), [src/utils.ts](../all/codex/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../all/codex/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

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
index 6ec11c1..7e153a1 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,34 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Returns every alias form of a path, sorted from longest to shortest.
+ *
+ * @param path - The real path to resolve back to aliases.
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
+    const target = normalizeWindowsPath(to);
+    if (
+      !_path.startsWith(target) ||
+      (!hasTrailingSlash(target) && !pathSeparators.has(_path[target.length]))
+    ) {
+      continue;
+    }
+
+    const suffix = _path.slice(target.length).replace(/^\//, "");
+    matches.push(suffix ? `${alias.replace(/\/$/, "")}/${suffix}` : alias);
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..9030ead 100644
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
@@ -32,6 +37,43 @@ describe("alias", () => {
     `);
   });
 
+  it("reverseResolveAlias", () => {
+    expect(
+      reverseResolveAlias("/root/some/assets/smth.jpg", {
+        "~": "/root",
+        "~assets": "/root/some/assets",
+      }),
+    ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
+    expect(
+      reverseResolveAlias("/root/index.js", {
+        "@": "/root",
+        "~": "/root/index.js",
+      }),
+    ).toEqual(["@/index.js", "~"]);
+    expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+      "~/foo/bar",
+    ]);
+    expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+    expect(reverseResolveAlias("./bar.js", { "@": "/root" })).toEqual([]);
+    expect(reverseResolveAlias("/rooted/file", { "@": "/root" })).toEqual([]);
+    expect(reverseResolveAlias("/root/bingpot/index.ts", _aliases)).toEqual([
+      "@/bingpot/index.ts",
+      "bingpot",
+    ]);
+    expect(reverseResolveAlias("/root/index.js", aliases)).toEqual([
+      "@/index.js",
+      "~",
+    ]);
+    expect(
+      reverseResolveAlias(String.raw`c:\src\foo`, { "~/": String.raw`C:\src` }),
+    ).toEqual(["~/foo"]);
+    expect(reverseResolveAlias("/src/foo", { "@": "/src/" })).toEqual([
+      "@/foo",
+    ]);
+    expect(reverseResolveAlias("/foo", { "@": "/" })).toEqual(["@/foo"]);
+    expect(reverseResolveAlias("", {})).toEqual([]);
+  });
+
   describe("resolveAlias", () => {
     for (const [from, to] of Object.entries(aliases)) {
       it(from, () => {
```

</details>

<details><summary>reply</summary>

`reverseResolveAlias` needs matching, export, and test checks before changes.


Done.
Added `reverseResolveAlias`, docs, edge-case tests. All 363 tests, lint, types, build passed.

</details>
