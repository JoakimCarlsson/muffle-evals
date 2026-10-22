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
| claude | muffle | pass | +17/-6 | 10 | 1,809 | $0.078 |
| claude | hush | pass | +16/-6 | 10 | 1,476 | $0.078 |
| claude | sloth | pass | +16/-6 | 0 | 3,431 | $0.155 |
| claude | all | pass | +15/-7 | 0 | 1,552 | $0.071 |
| codex | base | pass | +18/-8 | 43 | 1,636 | - |
| codex | muffle | pass | +12/-2 | 44 | 1,608 | - |
| codex | hush | pass | +11/-2 | 18 | 1,015 | - |
| codex | sloth | pass | +11/-2 | 0 | 1,120 | - |
| codex | all | pass | +11/-2 | 0 | 1,152 | - |

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

Files: [src/_parser.ts](../muffle/claude/ts-citty-kebab-default-1/files/src/_parser.ts), [test/_kebab.test.ts](../muffle/claude/ts-citty-kebab-default-1/files/test/_kebab.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..794380f 100644
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
@@ -163,14 +162,26 @@ export function parseRawArgs<T = Record<string, any>>(
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
+  // Apply defaults only after aliases are resolved, so a value passed via any
+  // alias (e.g. kebab-case) is not shadowed by the default of the main name
+  for (const [name, value] of Object.entries(defaults)) {
+    if (value !== undefined && (out as any)[name] === undefined) {
+      (out as any)[name] = value;
     }
   }
+  propagate();
 
   return out;
 }
diff --git a/test/_kebab.test.ts b/test/_kebab.test.ts
new file mode 100644
index 0000000..b6e29b4
--- /dev/null
+++ b/test/_kebab.test.ts
@@ -0,0 +1,10 @@
+import { expect, it } from "vitest";
+import { parseArgs } from "../src/args.ts";
+
+it("kebab-case input overrides camelCase default", () => {
+  const args = { fooBar: { type: "enum", options: ["one", "two"], default: "two" } } as const;
+  const r: any = parseArgs(["--foo-bar", "one"], args as any);
+  expect(r.fooBar).toBe("one");
+  expect(r["foo-bar"]).toBe("one");
+  expect((parseArgs([], args as any) as any).fooBar).toBe("two");
+});
```

</details>

<details><summary>reply</summary>

Let me see how the parser handles defaults and aliases.

`--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. The full suite passes (64 tests), including a new regression test.

**Cause:** `src/_parser.ts` handed the defaults to `node:util`'s `parseArgs`, which applied `fooBar: "two"` up front. The CLI value landed on the `foo-bar` alias. When the parser copied values between aliases, it saw `fooBar` already set and never overwrote it with `"one"`.

**Fix:** Defaults are no longer passed to `node:util`. The parser copies values between aliases first, then fills in any option still undefined with its default, then copies between aliases once more. A value passed under any spelling therefore takes priority over the default.

I added the regression test in `test/_kebab.test.ts`. It checks `--foo-bar one` against the `fooBar` enum from your report, and that with no flag the default `"two"` still applies.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [src/_parser.ts](../hush/claude/ts-citty-kebab-default-1/files/src/_parser.ts), [test/_kebab.test.ts](../hush/claude/ts-citty-kebab-default-1/files/test/_kebab.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..b3b030e 100644
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
+  // Apply defaults only after aliases resolved, so an explicit alias value wins
+  for (const [name, value] of Object.entries(defaults)) {
+    if ((out as any)[name] === undefined) {
+      (out as any)[name] = value;
     }
   }
+  propagateAliases();
 
   return out;
 }
diff --git a/test/_kebab.test.ts b/test/_kebab.test.ts
new file mode 100644
index 0000000..534a21e
--- /dev/null
+++ b/test/_kebab.test.ts
@@ -0,0 +1,10 @@
+import { expect, it } from "vitest";
+import { parseArgs } from "../src/args.ts";
+
+it("kebab input overrides camelCase default", () => {
+  const r = parseArgs(["--foo-bar", "one"], {
+    fooBar: { type: "enum", options: ["one", "two"], default: "two" },
+  });
+  expect(r.fooBar).toBe("one");
+  expect(r["foo-bar"]).toBe("one");
+});
```

</details>

<details><summary>reply</summary>

Need to see the parser's alias/default handling.

Done. `src/_parser.ts` now applies defaults after alias resolution, so `--foo-bar one` gives `fooBar: "one"` and `"foo-bar": "one"`. I added `test/_kebab.test.ts`; the full suite passes (64 tests).

</details>

### claude, sloth: pass

Files: [src/_parser.ts](../sloth/claude/ts-citty-kebab-default-1/files/src/_parser.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..b5e189e 100644
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
+
+  // Defaults apply only after aliases resolve, so an alias given on the CLI wins
+  propagateAliases();
+  for (const [name, value] of Object.entries(defaults)) {
+    if ((out as any)[name] === undefined) {
+      (out as any)[name] = value;
     }
   }
+  propagateAliases();
 
   return out;
 }
```

</details>

<details><summary>reply</summary>

You've hit your session limit · resets 11:30am (Europe/Stockholm)

Quick check of the reported case:

`--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. With no flag, `fooBar` is still `"two"`.

The cause was in `src/_parser.ts`. Defaults were handed to `node:util`'s `parseArgs`, which filled in `fooBar: "two"` before alias propagation ran. Propagation only copies a value to an alias that is still unset, so `foo-bar: "one"` never replaced the default.

The fix registers options without defaults, resolves aliases, and then applies each default only if the argument is still unset. It then propagates aliases once more so the default reaches every alias name.

- **Checks:** the existing suite passes (63 tests, no type errors). I also ran your exact case in a throwaway test, which passed, and deleted it afterwards. I didn't add a permanent regression test since you didn't ask for one.
- **Tool timeout:** my first test run hit the tool timeout and was killed. The rerun finished fine.

</details>

### claude, all: pass

Files: [src/_parser.ts](../all/claude/ts-citty-kebab-default-1/files/src/_parser.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..219c0d9 100644
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
@@ -162,15 +161,24 @@ export function parseRawArgs<T = Record<string, any>>(
     }
   }
 
-  // Propagate values between aliases
-  for (const [alias, main] of aliasToMain.entries()) {
-    if ((out as any)[alias] !== undefined && (out as any)[main] === undefined) {
-      (out as any)[main] = (out as any)[alias];
+  // Propagate values between aliases, then fill defaults so explicit values win over them
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
+  for (const [name, value] of Object.entries(defaults)) {
+    if ((out as any)[name] === undefined) {
+      (out as any)[name] = value;
     }
   }
+  propagateAliases();
 
   return out;
 }
```

</details>

<details><summary>reply</summary>

Need to see how parser handles defaults with aliases.

Done. `src/_parser.ts` now applies defaults only after alias propagation, so `--foo-bar one` gives `fooBar` and `"foo-bar"` both `"one"`. Existing 63 tests pass. A throwaway check of your case passed and I deleted it. I added no permanent test.

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

Files: [src/_parser.ts](../muffle/codex/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../muffle/codex/ts-citty-kebab-default-1/files/test/args.test.ts), [test/parser.test.ts](../muffle/codex/ts-citty-kebab-default-1/files/test/parser.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..9c1013b 100644
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
 
+  // Apply defaults after explicit values have been propagated across aliases.
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
index 732572c..4deb894 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -99,4 +99,28 @@ describe("args", () => {
     expect(parsed.userName).toBe("Jane");
     expect(parsed._).toEqual([]);
   });
+
+  it.each(["fooBar", "foo-bar"])("should override defaults using --%s", (name) => {
+    const parsed = parseArgs([`--${name}`, "one"], {
+      fooBar: { type: "enum", options: ["one", "two"], default: "two" },
+    });
+
+    expect(parsed).toEqual({ _: [], fooBar: "one", "foo-bar": "one" });
+  });
+
+  it("should preserve defaults for camelCase arguments when omitted", () => {
+    const parsed = parseArgs([], {
+      fooBar: { type: "enum", options: ["one", "two"], default: "two" },
+    });
+
+    expect(parsed).toEqual({ _: [], fooBar: "two", "foo-bar": "two" });
+  });
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
index b1794c0..c066309 100644
--- a/test/parser.test.ts
+++ b/test/parser.test.ts
@@ -34,6 +34,26 @@ describe("parseRawArgs", () => {
     });
   });
 
+  it.each(["name", "nickname", "n"])("overrides defaults through --%s", (name) => {
+    const result = parseRawArgs([`--${name}`, "Jane"], {
+      string: ["name"],
+      alias: { name: ["nickname", "n"] },
+      default: { name: "John" },
+    });
+
+    expect(result).toEqual({ _: [], name: "Jane", nickname: "Jane", n: "Jane" });
+  });
+
+  it("overrides false defaults through boolean aliases", () => {
+    const result = parseRawArgs(["--enable-feature"], {
+      boolean: ["enableFeature"],
+      alias: { enableFeature: ["enable-feature"] },
+      default: { enableFeature: false },
+    });
+
+    expect(result).toEqual({ _: [], enableFeature: true, "enable-feature": true });
+  });
+
   it("handles boolean flags", () => {
     const result = parseRawArgs(["--flag"], { boolean: ["flag"] });
```

</details>

<details><summary>reply</summary>

I’ll check how argument defaults and kebab-case names are handled, add a regression test, and fix the parser.

Defaults were being applied before alias values were copied, so the default blocked the explicit value. I moved default handling after alias resolution. The regression tests pass, including enum validation through `--foo-bar`; I’m checking lint and types now.

Fixed default handling so explicit alias values take precedence. `--foo-bar one` now sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression tests for defaults, aliases, boolean flags, and enum validation. All 71 tests, lint, formatting, and type checks pass.

</details>

### codex, hush: pass

Files: [src/_parser.ts](../hush/codex/ts-citty-kebab-default-1/files/src/_parser.ts), [test/args.test.ts](../hush/codex/ts-citty-kebab-default-1/files/test/args.test.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..5244139 100644
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
 
+  // Apply defaults only when neither the option nor its aliases were supplied.
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
index 732572c..2561f6a 100644
--- a/test/args.test.ts
+++ b/test/args.test.ts
@@ -76,6 +76,24 @@ describe("args", () => {
     }).toThrowError(result);
   });
 
+  it.each([
+    ["fooBar", "--foo-bar"],
+    ["foo-bar", "--fooBar"],
+    ["fooBar", "--fooBar"],
+  ])("should override defaults for %s with %s", (name, flag) => {
+    const definition: ArgsDef = {
+      [name]: { type: "enum", options: ["one", "two"], default: "two" },
+    };
+
+    const parsed = parseArgs([flag, "one"], definition);
+
+    expect(parsed).toEqual({ _: [], fooBar: "one", "foo-bar": "one" });
+    expect(parseArgs([], definition)).toEqual({ _: [], fooBar: "two", "foo-bar": "two" });
+    expect(() => parseArgs([flag, "three"], definition)).toThrowError(
+      "Invalid value for argument:",
+    );
+  });
+
   it("should resolve camelCase argument", () => {
     const definition: ArgsDef = {
       "user-name": { type: "string" },
```

</details>

<details><summary>reply</summary>

Fixing kebab-case overrides; checking parser and tests.


Done.
Aliases override defaults; camelCase and kebab-case values match. Regression tests added. All 66 tests, lint, formatting, types passed via local binaries; pnpm unavailable.

</details>

### codex, sloth: pass

Files: [src/_parser.ts](../sloth/codex/ts-citty-kebab-default-1/files/src/_parser.ts)

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
```

</details>

<details><summary>reply</summary>

I’ll check how defaults and argument aliases interact, fix the shared parser, then run the build and existing tests.

The parser applies defaults before resolving aliases, so it treats the default as an existing value and won’t replace it. I’ll apply defaults only when neither the argument nor its aliases has a value. This needs one shared-parser change; callers, exports, fixtures, and config need no changes. No new options or dependencies are needed.

Fixed in [src/_parser.ts](src/_parser.ts). Defaults now apply only when neither the argument nor its aliases has an explicit value.

Confirmed your example returns both `fooBar: "one"` and `"foo-bar": "one"`.

Build, lint, type checks, and all 63 existing tests passed. Since `pnpm` wasn’t installed, validation used npm and the installed tools directly.

</details>

### codex, all: pass

Files: [src/_parser.ts](../all/codex/ts-citty-kebab-default-1/files/src/_parser.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/_parser.ts b/src/_parser.ts
index 992c23d..c38f9ef 100644
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
```

</details>

<details><summary>reply</summary>

Done.
Defaults now respect explicit alias values, including kebab-case. Build, lint, types, 63 tests, and reproduction checks passed.

</details>
