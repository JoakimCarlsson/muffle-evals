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
| claude | base | pass | +35/-1 | 40 | 3,281 | $0.107 |
| claude | hush | pass | +34/-0 | 38 | 2,701 | $0.103 |
| claude | sloth | pass | +26/-0 | 38 | 2,544 | $0.083 |
| claude | all | pass | +32/-0 | 40 | 2,586 | $0.105 |
| codex | base | pass | +32/-0 | 57 | 1,683 | - |
| codex | muffle | pass | +28/-0 | 52 | 1,966 | - |
| codex | hush | pass | +33/-0 | 45 | 1,557 | - |
| codex | sloth | pass | +33/-0 | 59 | 2,185 | - |
| codex | all | pass | +27/-0 | 51 | 1,546 | - |

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
index 6ec11c1..1f44725 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,40 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Finds every aliased form of a real path, the opposite of `resolveAlias`.
+ * Aliases only match on a path separator boundary or the whole path.
+ *
+ * @param path - The real path string to find aliases for.
+ * @param aliases - A set of alias mappings to use for lookup.
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
+    let to = normalizeWindowsPath(target);
+    if (hasTrailingSlash(to)) {
+      to = to.slice(0, -1);
+    }
+    if (!_path.startsWith(to)) {
+      continue;
+    }
+    const rest = _path.slice(to.length);
+    if (rest && rest[0] !== "/") {
+      continue;
+    }
+    matches.add(
+      hasTrailingSlash(alias) ? alias + rest.slice(1) : alias + rest,
+    );
+  }
+  return [...matches].sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..52f1ec4 100644
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
+      expect(reverseResolveAlias("/rootfoo/a.js", { "~": "/root" })).toEqual(
+        [],
+      );
+    });
+    it("respect ending with /", () => {
+      expect(reverseResolveAlias("/src/foo/bar", aliases)).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", aliases)).toEqual(["~/"]);
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

I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`. The utils tests pass (36 tests) and `tsc --noEmit` is clean.

- **Matching:** it normalizes the aliases with `normalizeAliases` and the path and alias targets with `normalizeWindowsPath`, so `C:\src\foo` matches a `C:/src` target. An alias only matches on a separator boundary or the whole path, so `/rootfoo/a.js` doesn't match `"~": "/root"`.
- **Trailing `/` aliases:** these behave like `resolveAlias`, so `/src/foo/bar` gives `~/foo/bar` and `/src` gives `~/`.
- **Output:** results are deduplicated, sorted longest first, and `[]` when nothing matches.

I tried your examples as tests. Four of the five are covered as written. The `{ "~/": "/src" }` pair is tested against the existing test aliases instead, which include that entry.

I also added tests for the separator boundary and the Windows path, and added `reverseResolveAlias` to the import example in the README.

I didn't commit anything.

</details>

### claude, hush: pass

Files: [src/utils.ts](../hush/claude/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../hush/claude/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..1661d0d 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,40 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Finds every aliased form of a real path, the opposite of `resolveAlias`.
+ * An alias target only matches on a path separator boundary or the whole path.
+ *
+ * @param path - The real path to find aliases for.
+ * @param aliases - A set of alias mappings to use for resolution.
+ * @returns the aliased paths, longest first, or an empty array if none match.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  aliases = normalizeAliases(aliases);
+  const matches: string[] = [];
+  for (const [alias, to] of Object.entries(aliases)) {
+    // Strip trailing slashes so "/src/" and "/src" behave the same
+    const _to = normalizeWindowsPath(to).replace(/\/+$/, "");
+    if (!_path.startsWith(_to)) {
+      continue;
+    }
+
+    const rest = _path.slice(_to.length);
+    if (rest === "") {
+      matches.push(alias);
+    } else if (rest[0] === "/") {
+      matches.push(
+        (hasTrailingSlash(alias) ? alias.slice(0, -1) : alias) + rest,
+      );
+    }
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..36f641c 100644
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
+      expect(reverseResolveAlias("/rootless/a", { "@": "/root" })).toEqual([]);
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

Done. `reverseResolveAlias` is in `src/utils.ts` next to `resolveAlias`, with tests in `test/utils.spec.ts` (all pass). Typecheck not verified: `npx tsc` didn't run. README not updated.

</details>

### claude, sloth: pass

Files: [src/utils.ts](../sloth/claude/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../sloth/claude/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..6c833d3 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,32 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Finds every aliased form of a real path, the opposite of `resolveAlias`.
+ *
+ * @param path - The real path to find aliases for.
+ * @param aliases - A set of alias mappings to use, as accepted by `resolveAlias`.
+ * @returns the aliased paths sorted longest first, or an empty array if no alias matches.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+) {
+  const _path = normalizeWindowsPath(path);
+  const matches: string[] = [];
+  for (const [alias, to] of Object.entries(normalizeAliases(aliases))) {
+    const _to = normalizeWindowsPath(to).replace(/\/+$/, "");
+    if (!_path.startsWith(_to) || !pathSeparators.has(_path[_to.length])) {
+      continue;
+    }
+    const rest = _path.slice(_to.length);
+    matches.push(
+      hasTrailingSlash(alias) ? alias + rest.slice(1) : alias + rest,
+    );
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..9709b84 100644
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
@@ -88,4 +93,36 @@ describe("filename", () => {
       expect(filename(file)).toEqual(files[file]);
     });
   }
+
+  describe("reverseResolveAlias", () => {
+    it("returns all aliases longest first", () => {
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
+    it("respects ending with /", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+    });
+    it("normalizes windows paths and respects separators", () => {
+      expect(reverseResolveAlias("C:\\src\\foo", { "~": "C:/src" })).toEqual([
+        "~/foo",
+      ]);
+      expect(reverseResolveAlias("/rootless/x", { "~": "/root" })).toEqual([]);
+    });
+    it("unchanged", () => {
+      expect(reverseResolveAlias("./bar.js", { "@": "/root" })).toEqual([]);
+    });
+  });
 });
```

</details>

<details><summary>reply</summary>

I added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, right after `resolveAlias`. The utils tests pass, including new ones for your examples. The type-check printed nothing. I didn't run the rest of the repo's tests or lint.

- **Alias handling:** it normalizes the aliases with `normalizeAliases` and the path with `normalizeWindowsPath`, as `resolveAlias` does. It also normalizes each alias target.
- **Matching:** a target matches only on a `/` boundary or the whole path, so `/rootless/x` doesn't match `"~": "/root"`.
- **Trailing slash:** an alias ending in `/` drops the duplicate separator, so `/src/foo/bar` gives `~/foo/bar` and `/src` gives `~/`.
- **Result:** every match comes back sorted longest first, and no match returns `[]`.

The tests are in `test/utils.spec.ts` and cover all five of your examples. They also cover a Windows-style path and the separator boundary.

I used `prettier --write` on both files, so check the diff for formatting changes beyond the new code.

I haven't committed anything.

</details>

### claude, all: pass

Files: [src/utils.ts](../all/claude/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../all/claude/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..7aacffb 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,38 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Finds every aliased form of a real path, the reverse of `resolveAlias`.
+ *
+ * @param path - The real path string to find aliases for.
+ * @param aliases - A set of alias mappings to use for matching.
+ * @returns the aliased paths, longest first, or an empty array if none match.
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
+    if (rest === "") {
+      matches.push(alias);
+    } else if (rest[0] === "/") {
+      matches.push(
+        (hasTrailingSlash(alias) ? alias.slice(0, -1) : alias) + rest,
+      );
+    }
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..1b66a77 100644
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
+    it("returns all aliases longest first", () => {
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
+      expect(reverseResolveAlias("/rootfoo/a", { "@": "/root" })).toEqual([]);
+    });
+    it("respect ending with /", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+    });
+    it("normalizes windows paths", () => {
+      expect(reverseResolveAlias("C:\\src\\foo", { "~/": "C:/src" })).toEqual([
+        "~/foo",
+      ]);
+    });
+    it("no match", () => {
+      expect(reverseResolveAlias("./bar.js", { "@": "/root" })).toEqual([]);
+    });
+  });
 });
 
 describe("filename", () => {
```

</details>

<details><summary>reply</summary>

Done. `reverseResolveAlias` added in `src/utils.ts`, with tests covering all five examples, a separator-boundary case and a Windows path; vitest passes. `tsc` didn't run (npx printed a notice instead). README not updated.

</details>

### codex, base: pass

Files: [src/utils.ts](../base/codex/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../base/codex/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..d712f3a 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,38 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Returns every aliased form of a path, sorted from longest to shortest.
+ *
+ * @param path - The real path to resolve back to aliases.
+ * @param aliases - A set of alias mappings to use for resolution.
+ * @returns the matching aliased paths, or an empty array if none match.
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
+      (!hasTrailingSlash(to) && !hasTrailingSlash(_path[to.length]))
+    ) {
+      continue;
+    }
+
+    const suffix = _path.slice(to.length).replace(/^\//, "");
+    matches.push(
+      suffix ? `${alias}${hasTrailingSlash(alias) ? "" : "/"}${suffix}` : alias,
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
index 51ad676..5fd9e87 100644
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
@@ -32,6 +37,57 @@ describe("alias", () => {
     `);
   });
 
+  describe("reverseResolveAlias", () => {
+    it("returns every match sorted longest first", () => {
+      expect(
+        reverseResolveAlias("/root/some/assets/smth.jpg", {
+          "~assets": "/root/some/assets",
+          "~": "/root",
+        }),
+      ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
+      expect(reverseResolveAlias("/root/index.js", aliases)).toEqual([
+        "@/index.js",
+        "~",
+      ]);
+    });
+
+    it("respects path separator boundaries", () => {
+      expect(reverseResolveAlias("/rooted/foo", { "@": "/root" })).toEqual([]);
+      expect(reverseResolveAlias("./bar.js", aliases)).toEqual([]);
+    });
+
+    it("preserves aliases ending in a slash", () => {
+      expect(reverseResolveAlias("/src/foo/bar", aliases)).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", aliases)).toEqual(["~/"]);
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
+      expect(
+        reverseResolveAlias(String.raw`C:\root\index.js`, aliases),
+      ).toEqual(["~win"]);
+    });
+
+    it("handles targets ending in a separator", () => {
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

I’ll check the existing alias handling, add the reverse helper, and test the matching and sorting behavior.

Added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`.

It normalizes aliases and Windows paths, matches target boundaries, preserves trailing-slash aliases, and sorts results longest first.

Validation passed: all 368 tests, lint, formatting, type checks, and build.

</details>

### codex, muffle: pass

Files: [src/utils.ts](../muffle/codex/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../muffle/codex/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..9034f9e 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,34 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
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
+    matches.push(suffix ? alias.replace(/[/\\]$/, "") + suffix : alias);
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..8a9deac 100644
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
+    it("returns every match sorted by descending result length", () => {
+      expect(
+        reverseResolveAlias("/root/some/assets/smth.jpg", {
+          "~assets": "/root/some/assets",
+          "~": "/root",
+        }),
+      ).toEqual(["~/some/assets/smth.jpg", "~assets/smth.jpg"]);
+      expect(reverseResolveAlias("/root/index.js", aliases)).toEqual([
+        "@/index.js",
+        "~",
+      ]);
+    });
+
+    it("preserves trailing alias slashes for exact matches", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+    });
+
+    it("requires a whole target or a path separator boundary", () => {
+      expect(reverseResolveAlias("/rooted/foo", { "@": "/root" })).toEqual([]);
+      expect(reverseResolveAlias("./bar.js", aliases)).toEqual([]);
+    });
+
+    it("normalizes aliases and Windows paths", () => {
+      expect(reverseResolveAlias("/root/bingpot/index.ts", _aliases)).toEqual([
+        "@/bingpot/index.ts",
+        "bingpot",
+      ]);
+      expect(
+        reverseResolveAlias(String.raw`c:\src\foo`, {
+          "~/": String.raw`C:\src`,
+        }),
+      ).toEqual(["~/foo"]);
+    });
+
+    it("handles targets ending in a slash", () => {
+      expect(reverseResolveAlias("/src/foo", { "@/": "/src/" })).toEqual([
+        "@/foo",
+      ]);
+      expect(reverseResolveAlias("/foo", { "@": "/" })).toEqual(["@/foo"]);
+    });
+  });
+
   describe("resolveAlias", () => {
     for (const [from, to] of Object.entries(aliases)) {
       it(from, () => {
```

</details>

<details><summary>reply</summary>

I’ll check how `resolveAlias` handles normalization, add the reverse helper, and test the matching edge cases.

The helper and tests are in place. They cover the examples, alias normalization, Windows paths, and separator boundaries. `pnpm` isn’t available here, so I’ll run the checks using the installed local tools.

Added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`.

It normalizes aliases and Windows paths, matches targets at path boundaries, preserves trailing alias slashes, and sorts results longest first.

All 367 tests pass, along with lint, type checks, and build.

</details>

### codex, hush: pass

Files: [src/utils.ts](../hush/codex/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../hush/codex/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..d598eb7 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,39 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Returns every alias form of a path, sorted from longest to shortest.
+ *
+ * @param path - The real path to reverse resolve.
+ * @param aliases - The alias mappings to use for resolution.
+ * @returns the matching aliased paths.
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
+      alias + (hasTrailingSlash(alias) ? suffix.replace(/^\//, "") : suffix),
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
index 51ad676..cbea892 100644
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
@@ -32,6 +37,45 @@ describe("alias", () => {
     `);
   });
 
+  describe("reverseResolveAlias", () => {
+    it("returns all matches longest first", () => {
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
+    it("preserves trailing alias separators", () => {
+      expect(reverseResolveAlias("/src/foo/bar", aliases)).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", aliases)).toEqual(["~/"]);
+    });
+    it("normalizes alias chains and Windows paths", () => {
+      expect(reverseResolveAlias("/root/bingpot/index.ts", _aliases)).toEqual([
+        "@/bingpot/index.ts",
+        "bingpot",
+      ]);
+      expect(
+        reverseResolveAlias(String.raw`C:\src\foo`, { "~/": "C:\\src\\" }),
+      ).toEqual(["~/foo"]);
+    });
+    it("matches only whole targets and separator boundaries", () => {
+      expect(reverseResolveAlias("/rooted/foo", { "@": "/root" })).toEqual([]);
+      expect(reverseResolveAlias("./bar.js", aliases)).toEqual([]);
+      expect(reverseResolveAlias("/root/foo", { "@": "/root/" })).toEqual([
+        "@/foo",
+      ]);
+      expect(reverseResolveAlias("/foo", { "@": "/" })).toEqual(["@/foo"]);
+      expect(reverseResolveAlias("/foo", {})).toEqual([]);
+    });
+  });
+
   describe("resolveAlias", () => {
     for (const [from, to] of Object.entries(aliases)) {
       it(from, () => {
```

</details>

<details><summary>reply</summary>

Adding `reverseResolveAlias` beside `resolveAlias`, with tests for matching, ordering, and path normalization.


Done.
Added `reverseResolveAlias` and regression tests. All 366 tests, lint, formatting, and type checks passed.

</details>

### codex, sloth: pass

Files: [src/utils.ts](../sloth/codex/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../sloth/codex/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..9269b6d 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,39 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Returns every aliased form of a path, sorted from longest to shortest.
+ *
+ * @param path - The real path to resolve to aliases.
+ * @param aliases - A set of alias mappings to use for resolution.
+ * @returns the matching aliased paths.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  const matches: string[] = [];
+  for (const [alias, target] of Object.entries(normalizeAliases(aliases))) {
+    const to = normalizeWindowsPath(target);
+    if (
+      !_path.startsWith(to) ||
+      (!hasTrailingSlash(to) && !pathSeparators.has(_path[to.length]))
+    ) {
+      continue;
+    }
+    const suffix = _path.slice(to.length);
+    matches.push(
+      suffix
+        ? normalizeWindowsPath(alias).replace(/\/$/, "") +
+            "/" +
+            suffix.replace(/^\//, "")
+        : normalizeWindowsPath(alias),
+    );
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..6031506 100644
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
@@ -32,6 +37,59 @@ describe("alias", () => {
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
+    });
+    it("matches whole paths", () => {
+      expect(
+        reverseResolveAlias("/root/index.js", {
+          "@": "/root",
+          "~": "/root/index.js",
+        }),
+      ).toEqual(["@/index.js", "~"]);
+    });
+    it("preserves aliases ending with a slash", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+    });
+    it("returns no matches for unrelated paths or empty mappings", () => {
+      expect(reverseResolveAlias("./bar.js", { "@": "/root" })).toEqual([]);
+      expect(reverseResolveAlias("", { "@": "/root" })).toEqual([]);
+      expect(reverseResolveAlias("/root", {})).toEqual([]);
+    });
+    it("respects path separator boundaries", () => {
+      expect(reverseResolveAlias("/rooted/file", { "@": "/root" })).toEqual([]);
+      expect(reverseResolveAlias("/root/file", { "@": "/root/" })).toEqual([
+        "@/file",
+      ]);
+      expect(reverseResolveAlias("/file", { "@": "/" })).toEqual(["@/file"]);
+    });
+    it("normalizes alias mappings", () => {
+      expect(
+        reverseResolveAlias("/root/file", { "@": "/root", "~": "@/file" }),
+      ).toEqual(["@/file", "~"]);
+      expect(reverseResolveAlias("/root/index.js", aliases)).toEqual([
+        "@/index.js",
+        "~",
+      ]);
+    });
+    it("normalizes Windows paths and targets", () => {
+      expect(
+        reverseResolveAlias(String.raw`c:\src\foo\bar`, {
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

I’ll check the alias handling and existing tests, add the reverse helper, then run the build and relevant tests.

The helper now uses `normalizeAliases`, normalizes Windows paths, and sorts the resulting strings by length. I’m adding tests for all five examples, separator boundaries, and normalized alias targets.

Added `reverseResolveAlias` to `src/utils.ts` with normalization, boundary matching, trailing-slash support, and longest-first sorting.

All five examples and edge cases pass. Build, lint, formatting, 369 tests, and type checks passed using local binaries; `pnpm` was unavailable.

No extra options or dependencies added.

</details>

### codex, all: pass

Files: [src/utils.ts](../all/codex/ts-feat-pathe-reverse-alias-1/files/src/utils.ts), [test/utils.spec.ts](../all/codex/ts-feat-pathe-reverse-alias-1/files/test/utils.spec.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/utils.ts b/src/utils.ts
index 6ec11c1..861f119 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -74,6 +74,33 @@ export function resolveAlias(path: string, aliases: Record<string, string>) {
   return _path;
 }
 
+/**
+ * Returns every aliased form of a path, sorted from longest to shortest.
+ *
+ * @param path - The real path to resolve.
+ * @param aliases - Alias mappings to use for resolution.
+ * @returns matching aliased paths.
+ */
+export function reverseResolveAlias(
+  path: string,
+  aliases: Record<string, string>,
+): string[] {
+  const _path = normalizeWindowsPath(path);
+  const matches: string[] = [];
+  for (const [alias, to] of Object.entries(normalizeAliases(aliases))) {
+    const target = normalizeWindowsPath(to).replace(/\/$/, "");
+    if (_path.startsWith(target) && pathSeparators.has(_path[target.length])) {
+      const suffix = _path.slice(target.length);
+      matches.push(
+        hasTrailingSlash(alias) && suffix.startsWith("/")
+          ? alias + suffix.slice(1)
+          : alias + suffix,
+      );
+    }
+  }
+  return matches.sort((a, b) => b.length - a.length);
+}
+
 /**
  * Extracts the filename from a given path, excluding any directory paths and the file extension.
  *
diff --git a/test/utils.spec.ts b/test/utils.spec.ts
index 51ad676..cc1924c 100644
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
@@ -32,6 +37,51 @@ describe("alias", () => {
     `);
   });
 
+  describe("reverseResolveAlias", () => {
+    it("returns all matches longest first", () => {
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
+    it("preserves aliases ending in a slash", () => {
+      expect(reverseResolveAlias("/src/foo/bar", { "~/": "/src" })).toEqual([
+        "~/foo/bar",
+      ]);
+      expect(reverseResolveAlias("/src", { "~/": "/src" })).toEqual(["~/"]);
+    });
+    it("requires a target boundary", () => {
+      expect(reverseResolveAlias("./bar.js", { "@": "/root" })).toEqual([]);
+      expect(reverseResolveAlias("/rooted/file", { "@": "/root" })).toEqual([]);
+      expect(reverseResolveAlias("", {})).toEqual([]);
+    });
+    it("normalizes aliases and Windows paths", () => {
+      expect(reverseResolveAlias("/root/bingpot/index.ts", aliases)).toEqual([
+        "@/bingpot/index.ts",
+        "bingpot",
+      ]);
+      expect(
+        reverseResolveAlias(String.raw`C:\src\foo`, {
+          "~win/": String.raw`C:\src`,
+        }),
+      ).toEqual(["~win/foo"]);
+    });
+    it("handles targets ending in a separator", () => {
+      expect(reverseResolveAlias("/src/foo", { "@": "/src/" })).toEqual([
+        "@/foo",
+      ]);
+      expect(reverseResolveAlias("/foo", { "@": "/" })).toEqual(["@/foo"]);
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
Added `reverseResolveAlias` with normalization, boundary matching, slash handling, and length sorting. Build, lint, type checks, and all 367 tests passed.

</details>
