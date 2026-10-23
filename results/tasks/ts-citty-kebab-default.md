# ts-citty-kebab-default

Source: https://github.com/unjs/citty/pull/228

## Prompt

> Kebab-case CLI input does not override the default for camelCase-defined args.
> 
> When an argument is defined in camelCase (e.g. `fooBar`) with a default value, passing the kebab-case variant on the command line (`--foo-bar one`) does not override the default. The parsed `fooBar` stays the default instead of the value I passed.
> 
> ```js
> args: {
>   fooBar: { type: "enum", options: ["one", "two"], default: "two" },
> }
> ```
> 
> Running with `--foo-bar one` gives `fooBar: "two"`; I expected `fooBar: "one"` (and `"foo-bar": "one"`).
> 
> citty 0.2.1, Node v24.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [src/_parser.ts](../../tasks/ts-citty-kebab-default/upstream/src/_parser.ts), [test/args.test.ts](../../tasks/ts-citty-kebab-default/upstream/test/args.test.ts)

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..77b5113 100644
--- a/src/_parser.ts
+++ b/src/_parser.ts
@@ -170,6 +170,9 @@ export function parseRawArgs<T = Record<string, any>>(
     if ((out as any)[main] !== undefined && (out as any)[alias] === undefined) {
       (out as any)[alias] = (out as any)[main];
     }
+    if ((out as any)[alias] !== (out as any)[main] && defaults[main] === (out as any)[main]) {
+      (out as any)[main] = (out as any)[alias];
+    }
   }
 
   return out;
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +16/-6 | 12 | 1,789 | $0.082 |
| claude | muffle | pass | +16/-6 | 10 | 1,531 | $0.072 |
| claude | hush | pass | +12/-1 | 10 | 1,169 | $0.073 |
| claude | sloth | pass | +12/-2 | 5 | 1,875 | $0.088 |
| claude | all | pass | +16/-6 | 12 | 1,697 | $0.088 |
| codex | base | pass | +18/-8 | 43 | 1,636 | - |
| codex | muffle | pass | +18/-8 | 43 | 1,632 | - |
| codex | hush | pass | +8/-1 | 24 | 1,133 | - |
| codex | sloth | pass | +11/-2 | 29 | 1,959 | - |
| codex | all | pass | +11/-2 | 16 | 1,233 | - |

### claude, base: pass

Files: [src/_parser.ts](../base/claude/ts-citty-kebab-default-1/files/src/_parser.ts), [test/kebab-default.test.ts](../base/claude/ts-citty-kebab-default-1/files/test/kebab-default.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..b18212c 100644
--- a/src/_parser.ts
+++ b/src/_parser.ts
@@ -82,7 +82,6 @@ export function parseRawArgs<T = Record<string, any>>(
       const type = getType(name);
       options[name] = {
         type,
-        default: defaults[name],
       };
     }
   }
@@ -163,14 +162,25 @@ export function parseRawArgs<T = Record<string, any>>(
   }
 
   // Propagate values between aliases
-  for (const [alias, main] of aliasToMain.entries()) {
-    if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
-      (out as any)[main] = (out as any)[alias];
+  const propagateAliases = () => {
+    for (const [alias, main] of aliasToMain.entries()) {
+      if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
+        (out as any)[main] = (out as any)[alias];
+      }
+      if ((out as any)[main] !== undefined && (out as any)[alias] === undefined) {
+        (out as any)[alias] = (out as any)[main];
+      }
     }
-    if ((out as any)[main] !== undefined && (out as any)[alias] === undefined) {
-      (out as any)[alias] = (out as any)[main];
+  };
+  propagateAliases();
+
+  // Apply defaults last so a value passed via any alias (e.g. kebab-case) wins
+  for (const [name, value] of Object.entries(defaults)) {
+    if ((out as any)[name] === undefined) {
+      (out as any)[name] = value;
     }
   }
+  propagateAliases();
 
   return out;
 }
diff --git a/test/kebab-default.test.ts b/test/kebab-default.test.ts
new file mode 100644
index 0000000..e42ff64
--- /dev/null
+++ b/test/kebab-default.test.ts
@@ -0,0 +1,12 @@
+import { expect, it } from "vitest";
+import { parseArgs } from "../src/args.ts";
+
+it("kebab-case input overrides camelCase default", () => {
+  const args = {
+    fooBar: { type: "enum", options: ["one", "two"], default: "two" },
+  } as const;
+  const r: any = parseArgs(["--foo-bar", "one"], args as any);
+  expect(r.fooBar).toBe("one");
+  expect(r["foo-bar"]).toBe("one");
+  expect((parseArgs([], args as any) as any).fooBar).toBe("two");
+});
```

</details>

<details><summary>reply</summary>

`--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. With no flag passed, `fooBar` is still `"two"`. The full test suite and `tsc` both pass.

**Cause:** `src/_parser.ts` handed the defaults to `node:util`'s `parseArgs`. `fooBar` was therefore already set to `"two"` before alias propagation ran. The propagation step only fills an alias that is still `undefined`, so it never copied `"foo-bar": "one"` over it.

**Fix:** The defaults are now applied after parsing and alias propagation, and only to names that are still unset. Propagation then runs once more so every alias form carries the default. A value passed under any spelling (camelCase, kebab-case or an alias) now wins over the default.

I added a regression test in `test/kebab-default.test.ts`. It covers the kebab-case override and the default when nothing is passed.

I didn't commit anything.

</details>

### claude, muffle: pass

Files: [src/_parser.ts](../muffle/claude/ts-citty-kebab-default-1/files/src/_parser.ts), [test/kebab-default.test.ts](../muffle/claude/ts-citty-kebab-default-1/files/test/kebab-default.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..a8bde73 100644
--- a/src/_parser.ts
+++ b/src/_parser.ts
@@ -82,7 +82,6 @@ export function parseRawArgs<T = Record<string, any>>(
       const type = getType(name);
       options[name] = {
         type,
-        default: defaults[name],
       };
     }
   }
@@ -163,14 +162,25 @@ export function parseRawArgs<T = Record<string, any>>(
   }
 
   // Propagate values between aliases
-  for (const [alias, main] of aliasToMain.entries()) {
-    if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
-      (out as any)[main] = (out as any)[alias];
+  const propagate = () => {
+    for (const [alias, main] of aliasToMain.entries()) {
+      if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
+        (out as any)[main] = (out as any)[alias];
+      }
+      if ((out as any)[main] !== undefined && (out as any)[alias] === undefined) {
+        (out as any)[alias] = (out as any)[main];
+      }
     }
-    if ((out as any)[main] !== undefined && (out as any)[alias] === undefined) {
-      (out as any)[alias] = (out as any)[main];
+  };
+  propagate();
+
+  // Apply defaults last so a value given under any alias wins over them
+  for (const [name, value] of Object.entries(defaults)) {
+    if ((out as any)[name] === undefined) {
+      (out as any)[name] = value;
     }
   }
+  propagate();
 
   return out;
 }
diff --git a/test/kebab-default.test.ts b/test/kebab-default.test.ts
new file mode 100644
index 0000000..aff50da
--- /dev/null
+++ b/test/kebab-default.test.ts
@@ -0,0 +1,10 @@
+import { expect, it } from "vitest";
+import { parseArgs } from "../src/args.ts";
+
+it("kebab-case input overrides camelCase default", () => {
+  const def = { fooBar: { type: "enum", options: ["one", "two"], default: "two" } } as const;
+  const r: any = parseArgs(["--foo-bar", "one"], def as any);
+  expect(r.fooBar).toBe("one");
+  expect(r["foo-bar"]).toBe("one");
+  expect((parseArgs([], def as any) as any).fooBar).toBe("two");
+});
```

</details>

<details><summary>reply</summary>

Fixed: `--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. The full suite passes (64 tests), including a new regression test.

The default was handed to `node:util`'s `parseArgs` as a default on `fooBar`, so `fooBar` always had a value. The alias-propagation step only copies a value to an alias that is still undefined. The `"one"` that landed on `foo-bar` therefore never replaced `fooBar`'s default `"two"`.

In `src/_parser.ts`, defaults are no longer passed to `node:util`. They are applied after parsing and alias propagation, only to keys that are still undefined, and then propagated once more so every alias gets the default. A value passed under any alias form now wins over the default.

The regression test is `test/kebab-default.test.ts`. It also checks that the default `"two"` still applies when no flag is passed.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [src/_parser.ts](../hush/claude/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../hush/claude/ts-citty-kebab-default-1/files/test/args.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..62006d7 100644
--- a/src/_parser.ts
+++ b/src/_parser.ts
@@ -82,7 +82,6 @@ export function parseRawArgs<T = Record<string, any>>(
       const type = getType(name);
       options[name] = {
         type,
-        default: defaults[name],
       };
     }
   }
@@ -172,5 +171,17 @@ export function parseRawArgs<T = Record<string, any>>(
     }
   }
 
+  // Apply defaults only after alias propagation, so an explicit value passed
+  // via one spelling is not shadowed by the default of another spelling
+  for (const [name, value] of Object.entries(defaults)) {
+    if ((out as any)[name] !== undefined) continue;
+    (out as any)[name] = value;
+    for (const alias of mainToAliases.get(name) || []) {
+      if ((out as any)[alias] === undefined) {
+        (out as any)[alias] = value;
+      }
+    }
+  }
+
   return out;
 }
diff --git a/test/args.test.ts b/test/args.test.ts
index 732572c..2dcb8ae 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -100,3 +100,13 @@ describe("args", () => {
     expect(parsed._).toEqual([]);
   });
 });
+
+describe("kebab-case input with camelCase default", () => {
+  it("overrides default", () => {
+    const parsed = parseArgs(["--foo-bar", "one"], {
+      fooBar: { type: "enum", options: ["one", "two"], default: "two" },
+    });
+    expect(parsed.fooBar).toBe("one");
+    expect(parsed["foo-bar"]).toBe("one");
+  });
+});
```

</details>

<details><summary>reply</summary>

Done. `src/_parser.ts` now applies defaults after alias propagation, so `--foo-bar one` gives `fooBar: "one"` and `"foo-bar": "one"`. I added a test in `test/args.test.ts`, and all 64 tests pass.

</details>

### claude, sloth: pass

Files: [src/_parser.ts](../sloth/claude/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../sloth/claude/ts-citty-kebab-default-1/files/test/args.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..08a8bb9 100644
--- a/src/_parser.ts
+++ b/src/_parser.ts
@@ -51,7 +51,6 @@ export function parseRawArgs<T = Record<string, any>>(
     {
       type: "boolean" | "string";
       short?: string;
-      default?: any;
       multiple?: boolean;
     }
   > = {};
@@ -82,7 +81,6 @@ export function parseRawArgs<T = Record<string, any>>(
       const type = getType(name);
       options[name] = {
         type,
-        default: defaults[name],
       };
     }
   }
@@ -172,5 +170,17 @@ export function parseRawArgs<T = Record<string, any>>(
     }
   }
 
+  // Defaults apply after alias propagation so a value given via any alias wins
+  for (const [name, value] of Object.entries(defaults)) {
+    if ((out as any)[name] === undefined) {
+      (out as any)[name] = value;
+      for (const alias of mainToAliases.get(name) || []) {
+        if ((out as any)[alias] === undefined) {
+          (out as any)[alias] = value;
+        }
+      }
+    }
+  }
+
   return out;
 }
diff --git a/test/args.test.ts b/test/args.test.ts
index 732572c..d24c7be 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -11,6 +11,11 @@ describe("args", () => {
     [["--name", "John"], { name: { type: "string" } }, { name: "John", _: [] }],
     [[], { name: { type: "string", default: "John" } }, { name: "John", _: [] }],
     [["--name", "Jane"], { name: { type: "string", default: "John" } }, { name: "Jane", _: [] }],
+    [
+      ["--foo-bar", "one"],
+      { fooBar: { type: "enum", options: ["one", "two"], default: "two" } },
+      { fooBar: "one", "foo-bar": "one", _: [] },
+    ],
     [["-n", "Jane"], { name: { type: "string", alias: "n" } }, { name: "Jane", n: "Jane", _: [] }],
     /**
      * Boolean
```

</details>

<details><summary>reply</summary>

`--foo-bar one` now sets `fooBar` to `"one"`, and `"foo-bar"` is `"one"` too. I added a test for your exact case in `test/args.test.ts`. The full suite passes (64 tests) and there are no type errors.

The default was being handed to `node:util`'s `parseArgs` under the camelCase name. `fooBar` therefore always had a value, and the later step that copies a value between the `fooBar` and `foo-bar` names saw `fooBar` as already set and skipped it. In `src/_parser.ts` I now apply defaults after that copy step, so a value passed under any spelling takes priority. The default is then copied to the other spellings only where they're still unset.

I haven't committed anything.

</details>

### claude, all: pass

Files: [src/_parser.ts](../all/claude/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../all/claude/ts-citty-kebab-default-1/files/test/args.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..5906954 100644
--- a/src/_parser.ts
+++ b/src/_parser.ts
@@ -82,7 +82,6 @@ export function parseRawArgs<T = Record<string, any>>(
       const type = getType(name);
       options[name] = {
         type,
-        default: defaults[name],
       };
     }
   }
@@ -163,14 +162,25 @@ export function parseRawArgs<T = Record<string, any>>(
   }
 
   // Propagate values between aliases
-  for (const [alias, main] of aliasToMain.entries()) {
-    if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
-      (out as any)[main] = (out as any)[alias];
+  const propagateAliases = () => {
+    for (const [alias, main] of aliasToMain.entries()) {
+      if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
+        (out as any)[main] = (out as any)[alias];
+      }
+      if ((out as any)[main] !== undefined && (out as any)[alias] === undefined) {
+        (out as any)[alias] = (out as any)[main];
+      }
     }
-    if ((out as any)[main] !== undefined && (out as any)[alias] === undefined) {
-      (out as any)[alias] = (out as any)[main];
+  };
+  propagateAliases();
+
+  // Defaults apply only after aliases resolve, so an explicit alias value wins
+  for (const [name, value] of Object.entries(defaults)) {
+    if ((out as any)[name] === undefined) {
+      (out as any)[name] = value;
     }
   }
+  propagateAliases();
 
   return out;
 }
diff --git a/test/args.test.ts b/test/args.test.ts
index 732572c..680d9e7 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -88,6 +88,18 @@ describe("args", () => {
     expect(parsed._).toEqual([]);
   });
 
+  it("should override camelCase default with kebab-case input", () => {
+    const definition: ArgsDef = {
+      fooBar: { type: "enum", options: ["one", "two"], default: "two" },
+    };
+
+    const parsed = parseArgs(["--foo-bar", "one"], definition);
+
+    expect(parsed.fooBar).toBe("one");
+    expect(parsed["foo-bar"]).toBe("one");
+    expect(parseArgs([], definition).fooBar).toBe("two");
+  });
+
   it("should resolve kebab-case argument", () => {
     const definition: ArgsDef = {
       userName: { type: "string" },
```

</details>

<details><summary>reply</summary>

Done. `src/_parser.ts` now applies defaults after alias propagation, so `--foo-bar one` gives `fooBar: "one"` and `"foo-bar": "one"`. I added a test in `test/args.test.ts`. All 64 tests pass. I didn't commit.

</details>

### codex, base: pass

Files: [src/_parser.ts](../base/codex/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../base/codex/ts-citty-kebab-default-1/files/test/args.test.ts), [test/parser.test.ts](../base/codex/ts-citty-kebab-default-1/files/test/parser.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..7bbdedb 100644
--- a/src/_parser.ts
+++ b/src/_parser.ts
@@ -51,7 +51,6 @@ export function parseRawArgs<T = Record<string, any>>(
     {
       type: "boolean" | "string";
       short?: string;
-      default?: any;
       multiple?: boolean;
     }
   > = {};
@@ -82,7 +81,6 @@ export function parseRawArgs<T = Record<string, any>>(
       const type = getType(name);
       options[name] = {
         type,
-        default: defaults[name],
       };
     }
   }
@@ -162,13 +160,25 @@ export function parseRawArgs<T = Record<string, any>>(
     }
   }
 
-  // Propagate values between aliases
-  for (const [alias, main] of aliasToMain.entries()) {
-    if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
-      (out as any)[main] = (out as any)[alias];
+  // Resolve explicit values before defaults so an alias can override a default.
+  propagateAliases();
+
+  for (const [name, value] of Object.entries(defaults)) {
+    if ((out as any)[name] === undefined) {
+      (out as any)[name] = value;
     }
-    if ((out as any)[main] !== undefined && (out as any)[alias] === undefined) {
-      (out as any)[alias] = (out as any)[main];
+  }
+
+  propagateAliases();
+
+  function propagateAliases() {
+    for (const [alias, main] of aliasToMain.entries()) {
+      if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
+        (out as any)[main] = (out as any)[alias];
+      }
+      if ((out as any)[main] !== undefined && (out as any)[alias] === undefined) {
+        (out as any)[alias] = (out as any)[main];
+      }
     }
   }
 
diff --git a/test/args.test.ts b/test/args.test.ts
index 732572c..7c54d0d 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -99,4 +99,33 @@ describe("args", () => {
     expect(parsed.userName).toBe("Jane");
     expect(parsed._).toEqual([]);
   });
+
+  it.each(["fooBar", "foo-bar"])(
+    "should override defaults through either spelling of %s",
+    (name) => {
+      const definition: ArgsDef = {
+        [name]: { type: "enum", options: ["one", "two"], default: "two", alias: "f" },
+      };
+
+      for (const flag of ["--foo-bar", "--fooBar", "-f"]) {
+        const parsed = parseArgs([flag, "one"], definition);
+        expect(parsed).toEqual({ _: [], fooBar: "one", "foo-bar": "one", f: "one" });
+      }
+
+      expect(parseArgs([], definition)).toEqual({
+        _: [],
+        fooBar: "two",
+        "foo-bar": "two",
+        f: "two",
+      });
+    },
+  );
+
+  it("should validate an enum value supplied through an alias over its default", () => {
+    expect(() =>
+      parseArgs(["--foo-bar", "three"], {
+        fooBar: { type: "enum", options: ["one", "two"], default: "two" },
+      }),
+    ).toThrow("Invalid value for argument: --fooBar (three).");
+  });
 });
diff --git a/test/parser.test.ts b/test/parser.test.ts
index b1794c0..4d48c51 100644
--- a/test/parser.test.ts
+++ b/test/parser.test.ts
@@ -24,6 +24,20 @@ describe("parseRawArgs", () => {
     });
   });
 
+  it.each([
+    { args: ["--foo-bar", ""], type: "string", fallback: "default", value: "" },
+    { args: ["--foo-bar"], type: "boolean", fallback: false, value: true },
+    { args: ["--no-foo-bar"], type: "boolean", fallback: true, value: false },
+  ])("prefers explicit alias values over defaults: $args", ({ args, type, fallback, value }) => {
+    const result = parseRawArgs(args, {
+      [type]: ["fooBar"],
+      alias: { fooBar: ["foo-bar"] },
+      default: { fooBar: fallback },
+    });
+
+    expect(result).toEqual({ _: [], fooBar: value, "foo-bar": value });
+  });
+
   it("handles aliases", () => {
     const result = parseRawArgs(["-n", "John"], { alias: { n: ["name"] } });
```

</details>

<details><summary>reply</summary>

I’ll check how defaults interact with argument aliases, fix the precedence issue, and add a regression test.

The parser applies defaults before resolving aliases, which leaves the default in `fooBar` even when `foo-bar` has an explicit value. The regression tests also show that this bypasses enum validation. I’ll resolve explicit values across aliases before applying defaults.

Fixed: explicit CLI values now resolve across aliases before defaults are applied. `--foo-bar one` sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for both spellings, short aliases, enum validation, and boolean values.

All 69 tests, type checks, lint, and formatting checks pass.

</details>

### codex, muffle: pass

Files: [src/_parser.ts](../muffle/codex/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../muffle/codex/ts-citty-kebab-default-1/files/test/args.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..7bbdedb 100644
--- a/src/_parser.ts
+++ b/src/_parser.ts
@@ -51,7 +51,6 @@ export function parseRawArgs<T = Record<string, any>>(
     {
       type: "boolean" | "string";
       short?: string;
-      default?: any;
       multiple?: boolean;
     }
   > = {};
@@ -82,7 +81,6 @@ export function parseRawArgs<T = Record<string, any>>(
       const type = getType(name);
       options[name] = {
         type,
-        default: defaults[name],
       };
     }
   }
@@ -162,13 +160,25 @@ export function parseRawArgs<T = Record<string, any>>(
     }
   }
 
-  // Propagate values between aliases
-  for (const [alias, main] of aliasToMain.entries()) {
-    if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
-      (out as any)[main] = (out as any)[alias];
+  // Resolve explicit values before defaults so an alias can override a default.
+  propagateAliases();
+
+  for (const [name, value] of Object.entries(defaults)) {
+    if ((out as any)[name] === undefined) {
+      (out as any)[name] = value;
     }
-    if ((out as any)[main] !== undefined && (out as any)[alias] === undefined) {
-      (out as any)[alias] = (out as any)[main];
+  }
+
+  propagateAliases();
+
+  function propagateAliases() {
+    for (const [alias, main] of aliasToMain.entries()) {
+      if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
+        (out as any)[main] = (out as any)[alias];
+      }
+      if ((out as any)[main] !== undefined && (out as any)[alias] === undefined) {
+        (out as any)[alias] = (out as any)[main];
+      }
     }
   }
 
diff --git a/test/args.test.ts b/test/args.test.ts
index 732572c..cc1b25b 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -99,4 +99,47 @@ describe("args", () => {
     expect(parsed.userName).toBe("Jane");
     expect(parsed._).toEqual([]);
   });
+
+  it.each(["--foo-bar", "--fooBar", "--value", "-f"])(
+    "should override an enum default with %s",
+    (flag) => {
+      const parsed = parseArgs([flag, "one"], {
+        fooBar: {
+          type: "enum",
+          options: ["one", "two"],
+          default: "two",
+          alias: ["value", "f"],
+        },
+      });
+
+      expect(parsed).toEqual({
+        _: [],
+        fooBar: "one",
+        "foo-bar": "one",
+        value: "one",
+        f: "one",
+      });
+    },
+  );
+
+  it.each(["fooBar", "foo-bar"])("should resolve defaults and input for %s", (name) => {
+    const definition: ArgsDef = { [name]: { type: "string", default: "two" } };
+    expect(parseArgs([], definition)).toEqual({ _: [], fooBar: "two", "foo-bar": "two" });
+    expect(parseArgs(["--foo-bar", "one"], definition)).toEqual({
+      _: [],
+      fooBar: "one",
+      "foo-bar": "one",
+    });
+  });
+
+  it.each([
+    [false, "--foo-bar", true],
+    [true, "--no-foo-bar", false],
+  ] as const)("should override boolean default %s with %s", (value, flag, expected) => {
+    expect(parseArgs([flag], { fooBar: { type: "boolean", default: value } })).toEqual({
+      _: [],
+      fooBar: expected,
+      "foo-bar": expected,
+    });
+  });
 });
```

</details>

<details><summary>reply</summary>

I’ll check how argument names and defaults interact, fix the precedence issue, and add a regression test.

The parser applies defaults before copying values between aliases, so the default blocks the value passed as `--foo-bar`. I’ll apply defaults after resolving explicit values and test both casing variants, declared aliases, and boolean defaults.

Fixed default precedence: explicit CLI values now resolve across aliases before defaults are applied. `--foo-bar one` produces both `fooBar: "one"` and `"foo-bar": "one"`.

Added regression coverage for casing variants, declared aliases, and boolean defaults.

Validation passed: all 71 tests, type checking, lint, and formatting.

</details>

### codex, hush: pass

Files: [src/_parser.ts](../hush/codex/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../hush/codex/ts-citty-kebab-default-1/files/test/args.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..eea0fb3 100644
--- a/src/_parser.ts
+++ b/src/_parser.ts
@@ -82,7 +82,6 @@ export function parseRawArgs<T = Record<string, any>>(
       const type = getType(name);
       options[name] = {
         type,
-        default: defaults[name],
       };
     }
   }
@@ -162,6 +161,14 @@ export function parseRawArgs<T = Record<string, any>>(
     }
   }
 
+  // Apply defaults only when neither the option nor its aliases were supplied.
+  for (const [name, value] of Object.entries(defaults)) {
+    const names = [name, ...(mainToAliases.get(name) || [])];
+    if (names.every((key) => (out as any)[key] === undefined)) {
+      (out as any)[name] = value;
+    }
+  }
+
   // Propagate values between aliases
   for (const [alias, main] of aliasToMain.entries()) {
     if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
diff --git a/test/args.test.ts b/test/args.test.ts
index 732572c..8fc6f4b 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -3,6 +3,30 @@ import { parseArgs } from "../src/args.ts";
 import type { ArgsDef } from "../src/types.ts";
 
 describe("args", () => {
+  it.each(["fooBar", "foo-bar", "f"])("lets --%s override an enum default", (name) => {
+    const parsed = parseArgs([`--${name}`, "one"], {
+      fooBar: { type: "enum", options: ["one", "two"], default: "two", alias: "f" },
+    });
+
+    expect(parsed).toEqual({ _: [], fooBar: "one", "foo-bar": "one", f: "one" });
+  });
+
+  it("propagates an omitted enum default to all aliases", () => {
+    expect(
+      parseArgs([], {
+        fooBar: { type: "enum", options: ["one", "two"], default: "two", alias: "f" },
+      }),
+    ).toEqual({ _: [], fooBar: "two", "foo-bar": "two", f: "two" });
+  });
+
+  it("validates an enum value supplied through a kebab-case alias", () => {
+    expect(() =>
+      parseArgs(["--foo-bar", "three"], {
+        fooBar: { type: "enum", options: ["one", "two"], default: "two" },
+      }),
+    ).toThrow("Invalid value for argument: --fooBar (three).");
+  });
+
   it.each([
     [[], {}, { _: [] }],
     /**
```

</details>

<details><summary>reply</summary>

Done.
Aliases override defaults; added regression tests. All 68 tests, lint, formatting, type checks pass.

</details>

### codex, sloth: pass

Files: [src/_parser.ts](../sloth/codex/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../sloth/codex/ts-citty-kebab-default-1/files/test/args.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..d0015ed 100644
--- a/src/_parser.ts
+++ b/src/_parser.ts
@@ -11,6 +11,7 @@ export type Argv<T = Record<string, any>> = T & {
   _: string[];
 };
 
+/** Parses CLI arguments, resolving aliases before falling back to defaults. */
 export function parseRawArgs<T = Record<string, any>>(
   args: string[] = [],
   opts: ParseOptions = {},
@@ -51,7 +52,6 @@ export function parseRawArgs<T = Record<string, any>>(
     {
       type: "boolean" | "string";
       short?: string;
-      default?: any;
       multiple?: boolean;
     }
   > = {};
@@ -82,7 +82,6 @@ export function parseRawArgs<T = Record<string, any>>(
       const type = getType(name);
       options[name] = {
         type,
-        default: defaults[name],
       };
     }
   }
@@ -162,6 +161,16 @@ export function parseRawArgs<T = Record<string, any>>(
     }
   }
 
+  for (const [name, value] of Object.entries(defaults)) {
+    const aliases = mainToAliases.get(name) || [];
+    if (
+      (out as any)[name] === undefined &&
+      aliases.every((alias) => (out as any)[alias] === undefined)
+    ) {
+      (out as any)[name] = value;
+    }
+  }
+
   // Propagate values between aliases
   for (const [alias, main] of aliasToMain.entries()) {
     if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
diff --git a/test/args.test.ts b/test/args.test.ts
index 732572c..7864da5 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -68,6 +68,11 @@ describe("args", () => {
       { value: { type: "enum", options: ["one", "two"] } },
       "Invalid value for argument: --value (three). Expected one of: one, two.",
     ],
+    [
+      ["--foo-bar", "three"],
+      { fooBar: { type: "enum", options: ["one", "two"], default: "two" } },
+      "Invalid value for argument: --fooBar (three). Expected one of: one, two.",
+    ],
   ])("should throw error with %o (%o)", (rawArgs, definition, result) => {
     // TODO: should check for exact match
     // https://github.com/vitest-dev/vitest/discussions/6048
@@ -99,4 +104,28 @@ describe("args", () => {
     expect(parsed.userName).toBe("Jane");
     expect(parsed._).toEqual([]);
   });
+
+  it.each<[string[], ArgsDef, string | boolean]>([
+    [
+      ["--foo-bar", "one"],
+      { fooBar: { type: "enum", options: ["one", "two"], default: "two" } },
+      "one",
+    ],
+    [
+      ["--fooBar", "one"],
+      { "foo-bar": { type: "enum", options: ["one", "two"], default: "two" } },
+      "one",
+    ],
+    [[], { fooBar: { type: "enum", options: ["one", "two"], default: "two" } }, "two"],
+    [["--foo-bar", ""], { fooBar: { type: "string", default: "two" } }, ""],
+    [["--foo-bar"], { fooBar: { type: "boolean", default: false } }, true],
+    [["--no-foo-bar"], { fooBar: { type: "boolean", default: true } }, false],
+    [["-f", "one"], { fooBar: { type: "string", alias: "f", default: "two" } }, "one"],
+  ])("should resolve aliases before defaults with %o (%o)", (rawArgs, definition, value) => {
+    const parsed = parseArgs(rawArgs, definition);
+
+    expect(parsed.fooBar).toBe(value);
+    expect(parsed["foo-bar"]).toBe(value);
+    expect(parsed._).toEqual([]);
+  });
 });
```

</details>

<details><summary>reply</summary>

I’ll check how aliases and defaults interact, fix the shared parser, and add a regression test for this case.

The parser applies defaults before it resolves aliases, so the default blocks the value supplied through `--foo-bar`. I’ll defer defaults until explicit values and negated flags are known.

The change belongs in `src/_parser.ts`, with coverage in the existing argument tests. I checked the command caller, exports, and types; they need no changes. No new options or dependencies are needed.

Fixed the shared parser so `--foo-bar one` overrides the default and sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for aliases, omitted values, empty strings, booleans, and enum validation.

All 71 tests, lint, formatting, type checks, and build passed. Used local tools directly because `pnpm` wasn’t installed.

</details>

### codex, all: pass

Files: [src/_parser.ts](../all/codex/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../all/codex/ts-citty-kebab-default-1/files/test/args.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..5b6466c 100644
--- a/src/_parser.ts
+++ b/src/_parser.ts
@@ -11,6 +11,7 @@ export type Argv<T = Record<string, any>> = T & {
   _: string[];
 };
 
+/** Parse CLI arguments, resolving aliases before applying defaults. */
 export function parseRawArgs<T = Record<string, any>>(
   args: string[] = [],
   opts: ParseOptions = {},
@@ -51,7 +52,6 @@ export function parseRawArgs<T = Record<string, any>>(
     {
       type: "boolean" | "string";
       short?: string;
-      default?: any;
       multiple?: boolean;
     }
   > = {};
@@ -82,7 +82,6 @@ export function parseRawArgs<T = Record<string, any>>(
       const type = getType(name);
       options[name] = {
         type,
-        default: defaults[name],
       };
     }
   }
@@ -162,6 +161,16 @@ export function parseRawArgs<T = Record<string, any>>(
     }
   }
 
+  for (const [name, value] of Object.entries(defaults)) {
+    const aliases = mainToAliases.get(name) || [];
+    if (
+      (out as any)[name] === undefined &&
+      aliases.every((alias) => (out as any)[alias] === undefined)
+    ) {
+      (out as any)[name] = value;
+    }
+  }
+
   // Propagate values between aliases
   for (const [alias, main] of aliasToMain.entries()) {
     if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
diff --git a/test/args.test.ts b/test/args.test.ts
index 732572c..50cfaf0 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -76,6 +76,22 @@ describe("args", () => {
     }).toThrowError(result);
   });
 
+  it.each<[string[], ArgsDef[string], string | boolean]>([
+    [[], { type: "enum", options: ["one", "two"], default: "two" }, "two"],
+    [["--foo-bar", "one"], { type: "enum", options: ["one", "two"], default: "two" }, "one"],
+    [["--fooBar", "one"], { type: "enum", options: ["one", "two"], default: "two" }, "one"],
+    [["-f", "one"], { type: "enum", options: ["one", "two"], default: "two", alias: "f" }, "one"],
+    [["--foo-bar", ""], { type: "string", default: "two" }, ""],
+    [["--foo-bar"], { type: "boolean", default: false }, true],
+    [["--no-foo-bar"], { type: "boolean", default: true }, false],
+  ])("should override defaults through aliases with %o (%o)", (rawArgs, arg, expected) => {
+    const parsed = parseArgs(rawArgs, { fooBar: arg });
+
+    expect(parsed.fooBar).toBe(expected);
+    expect(parsed["foo-bar"]).toBe(expected);
+    expect(parsed._).toEqual([]);
+  });
+
   it("should resolve camelCase argument", () => {
     const definition: ArgsDef = {
       "user-name": { type: "string" },
```

</details>

<details><summary>reply</summary>

Done.
Kebab-case input now overrides camelCase defaults; both keys match. Added regression tests. All 70 tests, type checks, lint, formatting, build passed.

</details>
