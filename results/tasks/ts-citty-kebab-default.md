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
| claude | base | pass | +22/-6 | 12 | 1,672 | $0.072 |
| claude | muffle | pass | +11/-2 | 12 | 1,592 | $0.088 |
| claude | sloth | pass | +16/-6 | 11 | 1,883 | $0.084 |
| claude | all | pass | +16/-6 | 10 | 1,609 | $0.078 |
| codex | base | pass | +11/-2 | 23 | 1,141 | - |
| codex | muffle | pass | +8/-2 | 53 | 1,556 | - |
| codex | hush | pass | +8/-1 | 21 | 1,154 | - |
| codex | sloth | pass | +8/-2 | 12 | 1,075 | - |
| codex | all | pass | +10/-2 | 12 | 1,210 | - |

### claude, base: pass

Files: [src/_parser.ts](../base/claude/ts-citty-kebab-default-1/files/src/_parser.ts), [test/kebab-default.test.ts](../base/claude/ts-citty-kebab-default-1/files/test/kebab-default.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..6279134 100644
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
@@ -163,14 +162,31 @@ export function parseRawArgs<T = Record<string, any>>(
   }
 
   // Propagate values between aliases
-  for (const [alias, main] of aliasToMain.entries()) {
-    if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
-      (out as any)[main] = (out as any)[alias];
+  const propagateAliases = () => {
+    for (const [alias, main] of aliasToMain.entries()) {
+      if (
+        (out as any)[alias] !== undefined &&
+        (out as any)[main] === undefined
+      ) {
+        (out as any)[main] = (out as any)[alias];
+      }
+      if (
+        (out as any)[main] !== undefined &&
+        (out as any)[alias] === undefined
+      ) {
+        (out as any)[alias] = (out as any)[main];
+      }
     }
-    if ((out as any)[main] !== undefined && (out as any)[alias] === undefined) {
-      (out as any)[alias] = (out as any)[main];
+  };
+  propagateAliases();
+
+  // Apply defaults last so values passed via any alias take precedence
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
index 0000000..d8b0f10
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
+  const parsed = parseArgs(["--foo-bar", "one"], args as any) as any;
+  expect(parsed.fooBar).toBe("one");
+  expect(parsed["foo-bar"]).toBe("one");
+  expect((parseArgs([], args as any) as any).fooBar).toBe("two");
+});
```

</details>

<details><summary>reply</summary>

Passing `--foo-bar one` now overrides the default, so `fooBar` is `"one"` and `"foo-bar"` is `"one"`. With no flag, `fooBar` is still `"two"`. The full test suite passes (64 tests).

The cause was in `src/_parser.ts`. Defaults were handed to `node:util`'s `parseArgs`, so `fooBar` was already `"two"` before the aliases were merged. The merge only fills in a name that is `undefined`, so `"foo-bar": "one"` never replaced it.

Now defaults are applied after parsing and alias merging, and only to names that are still unset. Aliases are merged once more afterwards so the default shows up under every name.

I added a regression test in `test/kebab-default.test.ts`. I haven't committed anything.

</details>

### claude, muffle: pass

Files: [src/_parser.ts](../muffle/claude/ts-citty-kebab-default-1/files/src/_parser.ts), [test/kebab-default.test.ts](../muffle/claude/ts-citty-kebab-default-1/files/test/kebab-default.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..c5c265d 100644
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
@@ -172,5 +170,16 @@ export function parseRawArgs<T = Record<string, any>>(
     }
   }
 
+  // Apply defaults last so a value passed via any alias takes precedence
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
diff --git a/test/kebab-default.test.ts b/test/kebab-default.test.ts
new file mode 100644
index 0000000..7fa9cf9
--- /dev/null
+++ b/test/kebab-default.test.ts
@@ -0,0 +1,12 @@
+import { expect, it } from "vitest";
+import { parseArgs } from "../src/args.ts";
+
+it("kebab-case input overrides camelCase default", () => {
+  const args = { fooBar: { type: "enum", options: ["one", "two"], default: "two" } } as const;
+  const r = parseArgs(["--foo-bar", "one"], args as any) as any;
+  expect(r.fooBar).toBe("one");
+  expect(r["foo-bar"]).toBe("one");
+  const d = parseArgs([], args as any) as any;
+  expect(d.fooBar).toBe("two");
+  expect(d["foo-bar"]).toBe("two");
+});
```

</details>

<details><summary>reply</summary>

Let me see how the parser handles defaults and aliases.

Node's `parseArgs` applies the default to `fooBar`, so the propagation step sees it as already set and never copies `foo-bar`'s value over. I'll apply defaults after alias propagation instead.

`--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. The full suite passes (64 tests) and `tsc` reports no errors.

**Cause:** `src/_parser.ts` passed defaults to Node's `parseArgs`, so `fooBar` was pre-filled with `"two"` while only `foo-bar` received `"one"`. The alias-propagation step only copies a value when the target is undefined, so it never overwrote the default.

**Fix:** In `src/_parser.ts`, I removed the `default` option from the Node `parseArgs` call. Defaults are now applied at the end, after alias propagation, to any name still undefined, and mirrored to its aliases. So a value passed under any spelling beats the default, and with no input you still get `"two"` for both `fooBar` and `foo-bar`.

I added `test/kebab-default.test.ts`, which covers both the override case and the default case. I haven't committed anything.

</details>

### claude, sloth: pass

Files: [src/_parser.ts](../sloth/claude/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../sloth/claude/ts-citty-kebab-default-1/files/test/args.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..90c0748 100644
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
+  // Defaults apply only after aliases resolve, so an aliased value is not shadowed by a default
+  for (const [key, value] of Object.entries(defaults)) {
+    if ((out as any)[key] === undefined) {
+      (out as any)[key] = value;
     }
   }
+  propagateAliases();
 
   return out;
 }
diff --git a/test/args.test.ts b/test/args.test.ts
index 732572c..4452d3c 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -99,4 +99,15 @@ describe("args", () => {
     expect(parsed.userName).toBe("Jane");
     expect(parsed._).toEqual([]);
   });
+
+  it("should let kebab-case input override camelCase default", () => {
+    const definition: ArgsDef = {
+      fooBar: { type: "enum", options: ["one", "two"], default: "two" },
+    };
+
+    const parsed = parseArgs(["--foo-bar", "one"], definition);
+
+    expect(parsed.fooBar).toBe("one");
+    expect(parsed["foo-bar"]).toBe("one");
+  });
 });
```

</details>

<details><summary>reply</summary>

`--foo-bar one` now overrides the default, so `fooBar` is `"one"` and `"foo-bar"` is `"one"`. The full suite passes (64 tests), including a new test for your example.

**Cause:** the parser gave defaults to `node:util` `parseArgs`, so `fooBar` was already `"two"` before alias propagation ran. Propagation only copies a value when the target is undefined, so the `foo-bar` value never reached `fooBar`.

**Fix:** in `src/_parser.ts`, defaults are now applied after the first alias propagation, only to keys still undefined, followed by a second propagation. The new test is in `test/args.test.ts`.

</details>

### claude, all: pass

Files: [src/_parser.ts](../all/claude/ts-citty-kebab-default-1/files/src/_parser.ts), [test/kebab-default.test.ts](../all/claude/ts-citty-kebab-default-1/files/test/kebab-default.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..d82a3e8 100644
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
+  // Defaults apply only after aliases resolve, so an aliased CLI value wins
+  for (const [key, value] of Object.entries(defaults)) {
+    if ((out as any)[key] === undefined) {
+      (out as any)[key] = value;
     }
   }
+  propagateAliases();
 
   return out;
 }
diff --git a/test/kebab-default.test.ts b/test/kebab-default.test.ts
new file mode 100644
index 0000000..352199d
--- /dev/null
+++ b/test/kebab-default.test.ts
@@ -0,0 +1,10 @@
+import { expect, it } from "vitest";
+import { parseArgs } from "../src/args.ts";
+
+it("kebab-case input overrides camelCase default", () => {
+  const args = { fooBar: { type: "enum", options: ["one", "two"], default: "two" } } as const;
+  const r = parseArgs(["--foo-bar", "one"], args as any) as any;
+  expect(r.fooBar).toBe("one");
+  expect(r["foo-bar"]).toBe("one");
+  expect((parseArgs([], args as any) as any).fooBar).toBe("two");
+});
```

</details>

<details><summary>reply</summary>

Done. `src/_parser.ts` now applies defaults after alias resolution, so `--foo-bar one` gives `fooBar: "one"` and `"foo-bar": "one"`. I added `test/kebab-default.test.ts`, and all 64 tests pass.

</details>

### codex, base: pass

Files: [src/_parser.ts](../base/codex/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../base/codex/ts-citty-kebab-default-1/files/test/args.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..82ac226 100644
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
@@ -162,6 +160,17 @@ export function parseRawArgs<T = Record<string, any>>(
     }
   }
 
+  // Apply defaults only when neither the option nor any alias was provided.
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
index 732572c..5466a7d 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -99,4 +99,27 @@ describe("args", () => {
     expect(parsed.userName).toBe("Jane");
     expect(parsed._).toEqual([]);
   });
+
+  it.each<ArgsDef[string]>([
+    { type: "enum", options: ["one", "two"], default: "two" },
+    { type: "string", default: "two" },
+    { type: "boolean", default: false },
+  ])("should override defaults through argument variants (%o)", (arg) => {
+    for (const name of ["fooBar", "foo-bar"]) {
+      const definition: ArgsDef = { [name]: { ...arg, alias: "f" } };
+      const value = arg.type === "boolean" ? true : "one";
+      for (const flag of ["--fooBar", "--foo-bar", "-f"]) {
+        const parsed = parseArgs(arg.type === "boolean" ? [flag] : [flag, "one"], definition);
+
+        expect(parsed).toEqual({ _: [], fooBar: value, "foo-bar": value, f: value });
+      }
+
+      expect(parseArgs([], definition)).toEqual({
+        _: [],
+        fooBar: arg.default,
+        "foo-bar": arg.default,
+        f: arg.default,
+      });
+    }
+  });
 });
```

</details>

<details><summary>reply</summary>

I’ll check argument parsing, fix how defaults interact with kebab-case input, and add a regression test.

Node’s parser applies the default before citty resolves aliases, so alias resolution sees `fooBar` as already set. I’ll apply defaults only when neither the argument nor an alias has an explicit value, with tests for enum, string, and boolean arguments.

Fixed. Explicit kebab-case input now overrides the camelCase argument’s default and populates both `fooBar` and `"foo-bar"`.

Added regression coverage for enums, strings, booleans, and aliases. All 66 tests pass, along with type, lint, and formatting checks.

</details>

### codex, muffle: pass

Files: [src/_parser.ts](../muffle/codex/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../muffle/codex/ts-citty-kebab-default-1/files/test/args.test.ts), [test/parser.test.ts](../muffle/codex/ts-citty-kebab-default-1/files/test/parser.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..ba6b11d 100644
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
@@ -162,6 +160,14 @@ export function parseRawArgs<T = Record<string, any>>(
     }
   }
 
+  // Apply defaults only when neither the option nor an alias was provided.
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
index 732572c..2f6225a 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -99,4 +99,37 @@ describe("args", () => {
     expect(parsed.userName).toBe("Jane");
     expect(parsed._).toEqual([]);
   });
+
+  it.each(["string", "enum"] as const)(
+    "should override a camelCase %s default through any alias",
+    (type) => {
+      const definition: ArgsDef = {
+        fooBar: { type, options: ["one", "two"], default: "two", alias: "f" },
+      };
+
+      for (const flag of ["--foo-bar", "--fooBar", "-f"]) {
+        expect(parseArgs([flag, "one"], definition)).toEqual({
+          _: [],
+          fooBar: "one",
+          "foo-bar": "one",
+          f: "one",
+        });
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
+  it("should validate enum values supplied through kebab-case aliases", () => {
+    expect(() =>
+      parseArgs(["--foo-bar", "three"], {
+        fooBar: { type: "enum", options: ["one", "two"], default: "two" },
+      }),
+    ).toThrow("Invalid value for argument: --fooBar (three)");
+  });
 });
diff --git a/test/parser.test.ts b/test/parser.test.ts
index b1794c0..e103d20 100644
--- a/test/parser.test.ts
+++ b/test/parser.test.ts
@@ -34,6 +34,26 @@ describe("parseRawArgs", () => {
     });
   });
 
+  it.each([true, false])("overrides a boolean default of %s through an alias", (value) => {
+    const result = parseRawArgs(["--enable-feature"], {
+      boolean: ["enableFeature"],
+      alias: { enableFeature: ["enable-feature"] },
+      default: { enableFeature: value },
+    });
+
+    expect(result).toEqual({ _: [], enableFeature: true, "enable-feature": true });
+  });
+
+  it("overrides a kebab-case default through a camelCase alias", () => {
+    const result = parseRawArgs(["--fooBar", "one"], {
+      string: ["foo-bar"],
+      alias: { "foo-bar": ["fooBar"] },
+      default: { "foo-bar": "two" },
+    });
+
+    expect(result).toEqual({ _: [], "foo-bar": "one", fooBar: "one" });
+  });
+
   it("handles boolean flags", () => {
     const result = parseRawArgs(["--flag"], { boolean: ["flag"] });
```

</details>

<details><summary>reply</summary>

I’ll check how defaults interact with kebab-case input, fix the precedence issue, and add a regression test.

Defaults are being applied before aliases are resolved, so the default blocks the value passed through `--foo-bar`. I’ve changed defaults to apply only when neither the argument nor an alias was supplied, and added regression coverage. I’ll run the checks using the installed tools; `pnpm` isn’t available here.

Fixed: `--foo-bar one` now overrides the `fooBar` default and sets both keys to `"one"`.

Defaults apply only when neither the argument nor an alias was supplied. Added regression tests covering enums, strings, booleans, aliases, and enum validation.

All 69 tests pass, along with type, lint, and formatting checks.

</details>

### codex, hush: pass

Files: [src/_parser.ts](../hush/codex/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../hush/codex/ts-citty-kebab-default-1/files/test/args.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..15ad4a3 100644
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
 
+  // Apply defaults only when neither the option nor any alias was supplied.
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
index 732572c..b1e2d53 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -3,6 +3,27 @@ import { parseArgs } from "../src/args.ts";
 import type { ArgsDef } from "../src/types.ts";
 
 describe("args", () => {
+  it.each<ArgsDef[string]>([
+    { type: "enum", options: ["one", "two"], default: "two" },
+    { type: "string", default: "two" },
+    { type: "boolean", default: false },
+  ])("lets case variants and aliases override defaults: %o", (arg) => {
+    for (const name of ["fooBar", "foo-bar"]) {
+      const definition: ArgsDef = { [name]: { ...arg, alias: "f" } };
+      const value = arg.type === "boolean" ? true : "one";
+      for (const flag of ["--fooBar", "--foo-bar", "-f"]) {
+        const parsed = parseArgs(arg.type === "boolean" ? [flag] : [flag, "one"], definition);
+        expect(parsed).toEqual({ _: [], fooBar: value, "foo-bar": value, f: value });
+      }
+      expect(parseArgs([], definition)).toEqual({
+        _: [],
+        fooBar: arg.default,
+        "foo-bar": arg.default,
+        f: arg.default,
+      });
+    }
+  });
+
   it.each([
     [[], {}, { _: [] }],
     /**
```

</details>

<details><summary>reply</summary>

Done.
Defaults now respect kebab-case input and aliases. Added regression coverage; 66 tests, type checks, lint, formatting passed.

</details>

### codex, sloth: pass

Files: [src/_parser.ts](../sloth/codex/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../sloth/codex/ts-citty-kebab-default-1/files/test/args.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..960e2d2 100644
--- a/src/_parser.ts
+++ b/src/_parser.ts
@@ -11,6 +11,7 @@ export type Argv<T = Record<string, any>> = T & {
   _: string[];
 };
 
+/** Parses CLI arguments, resolving aliases before applying defaults. */
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
@@ -162,6 +161,13 @@ export function parseRawArgs<T = Record<string, any>>(
     }
   }
 
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
index 732572c..effcf62 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -99,4 +99,16 @@ describe("args", () => {
     expect(parsed.userName).toBe("Jane");
     expect(parsed._).toEqual([]);
   });
+
+  it.each([
+    [[], "two"],
+    [["--foo-bar", "one"], "one"],
+    [["--fooBar", "one"], "one"],
+  ])("should resolve enum defaults with %o", (rawArgs, expected) => {
+    const parsed = parseArgs(rawArgs as string[], {
+      fooBar: { type: "enum", options: ["one", "two"], default: "two" },
+    });
+
+    expect(parsed).toEqual({ _: [], fooBar: expected, "foo-bar": expected });
+  });
 });
```

</details>

<details><summary>reply</summary>

I’ll check how argument aliases and defaults interact, add a regression test, and run the build and relevant tests.

Defaults are being applied before aliases are resolved, so the default blocks the supplied value. I’ve moved default handling later and added tests for both spellings and omitted input. `pnpm` isn’t available here, so I’ll use the installed build and test executables.

Fixed default handling in the shared parser. `--foo-bar one` now sets both `fooBar` and `"foo-bar"` to `"one"`.

Build and all 31 relevant tests passed, including regressions for both spellings and omitted input.

No new options or dependencies. Full suite and lint were not run.

</details>

### codex, all: pass

Files: [src/_parser.ts](../all/codex/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../all/codex/ts-citty-kebab-default-1/files/test/args.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..eb6785d 100644
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
@@ -142,6 +140,16 @@ export function parseRawArgs<T = Record<string, any>>(
     (out as any)[key] = value;
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
   // Apply negated flags (with alias resolution)
   for (const [name] of Object.entries(negatedFlags)) {
     // Set the flag itself
diff --git a/test/args.test.ts b/test/args.test.ts
index 732572c..79668ca 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -3,6 +3,18 @@ import { parseArgs } from "../src/args.ts";
 import type { ArgsDef } from "../src/types.ts";
 
 describe("args", () => {
+  it.each([
+    [[], "two"],
+    [["--foo-bar", "one"], "one"],
+    [["--fooBar", "one"], "one"],
+  ] as [string[], string][])("resolves enum defaults with %o", (rawArgs, value) => {
+    const parsed = parseArgs(rawArgs, {
+      fooBar: { type: "enum", options: ["one", "two"], default: "two" },
+    });
+
+    expect(parsed).toEqual({ _: [], fooBar: value, "foo-bar": value });
+  });
+
   it.each([
     [[], {}, { _: [] }],
     /**
```

</details>

<details><summary>reply</summary>

Done.
Kebab-case input now overrides camelCase defaults; both keys agree. Build, lint, types, 66 tests passed. Node v24 not checked.

</details>
