# ts-yaml-flow-key-after-blank

Source: https://github.com/eemeli/yaml/pull/700

## Prompt

> Parsing this YAML throws an `IMPOSSIBLE` error:
> 
> ```yaml
> ? - Detroit Tigers
>   - Chicago cubs
> : - 2001-07-23
> 
> [New York Yankees, Atlanta Braves]: [2001-07-02, 2001-08-12, 2001-08-14]
> ```
> 
> ```js
> require('yaml').parse(fs.readFileSync('./test.yaml', 'utf8'))
> ```
> 
> ```
> Uncaught YAMLParseError: Map comment with trailing content at line 5, column 1:
> 
> [New York Yankees, Atlanta Braves]: [2001-07-02, 2001-08-12, 2001-08-14]
> ^
>   code: 'IMPOSSIBLE',
> ```
> 
> This is "Example 2.11 Mapping between Sequences" from the YAML 1.2.2 spec, as Prettier reformats it. A smaller case like `1: 2\n\n[3]: 4` fails the same way: it seems to happen whenever a flow collection is used as a block map key and there is a blank line (or a comment line) before it. Without the blank line it parses fine. The docs say `IMPOSSIBLE` should never happen.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [src/parse/parser.ts](../../tasks/ts-yaml-flow-key-after-blank/upstream/src/parse/parser.ts), [tests/doc/parse.ts](../../tasks/ts-yaml-flow-key-after-blank/upstream/tests/doc/parse.ts)

```diff
diff --git a/src/parse/parser.ts b/src/parse/parser.ts
index 1443cc1..e5599d1 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,10 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (
+              atMapIndent &&
+              (it.sep || it.explicitKey || start.length > 0)
+            ) {
               map.items.push({ start })
             }
             this.stack.push(bv)
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +1/-1 | 8 | 5,823 | $0.227 |
| claude | muffle | pass | +1/-1 | 18 | 9,809 | $0.313 |
| claude | hush | pass | +4/-1 | 10 | 4,794 | $0.195 |
| claude | sloth | pass | +4/-1 | 0 | 2,823 | $0.124 |
| claude | all | pass | +1/-1 | 0 | 2,503 | $0.114 |
| codex | base | **FAIL** | +1/-1 | 51 | 2,442 | - |
| codex | muffle | pass | +1/-1 | 36 | 1,901 | - |
| codex | hush | pass | +1/-1 | 36 | 1,467 | - |
| codex | sloth | pass | +1/-1 | 0 | 2,109 | - |
| codex | all | **FAIL** | +1/-1 | 0 | 1,547 | - |

### claude, base: pass

Files: [src/parse/parser.ts](../base/claude/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts), [tests/doc/parse.ts](../base/claude/ts-yaml-flow-key-after-blank-1/files/tests/doc/parse.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/parse/parser.ts b/src/parse/parser.ts
index 1443cc1..cfad545 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,7 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (atMapIndent && (atNextItem || it.value)) {
               map.items.push({ start })
             }
             this.stack.push(bv)
diff --git a/tests/doc/parse.ts b/tests/doc/parse.ts
index 1364d0a..4e84212 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -278,6 +278,14 @@ test('comment between key & : in flow collection (#149)', () => {
   expect(doc.errors).toMatchObject([{ code: 'MISSING_CHAR' }])
 })
 
+test('flow collection key after blank line or comment', () => {
+  for (const src of ['1: 2\n\n[3]: 4', '1: 2\n# c\n[3]: 4', '1: 2\n\n{a: b}: 4']) {
+    const doc = YAML.parseDocument(src)
+    expect(doc.errors).toEqual([])
+    expect(doc.toJS({ mapAsMap: true }).size).toBe(2)
+  }
+})
+
 describe('indented key with anchor (#378)', () => {
   test('followed by value', () => {
     const src1 = '&a foo: 1\n&b bar: 2'
```

</details>

<details><summary>reply</summary>

Tracing how the parser builds the CST for a flow-collection key after a blank line.

Root `/` was a bad idea. I'll run it from the project instead.

The fix works on my samples. I'm now checking whether the 2 failing test files were already failing before my change.

The two failing files fail without my change too. They need the `json-test-suite` and `yaml-test-suite` submodules, which aren't checked out here. Now I'll add a regression test.

This failure is in my test. `contents` is `undefined` in this version, so I'll assert on the parsed value instead.

Your YAML example and the smaller `1: 2\n\n[3]: 4` case now parse without the `IMPOSSIBLE` error. The `tests/doc` tests and the type checks pass.

**Cause:** in `blockMap()` in `src/parse/parser.ts`, a flow collection used as a key at the map's indent always started a new item. A blank line or comment line before it had already created an item holding just that whitespace, so the empty item was left behind and `resolveBlockMap` reported it as a stray comment.

**Fix:** the parser now starts a new item only when the previous one is finished, meaning it has a separator or a value. This is the same rule the scalar-key case already uses. Otherwise the flow collection joins the whitespace-only item.

**Tests:** I added a regression test in `tests/doc/parse.ts`. It covers a blank line before `[3]: 4`, a comment line before it, and a `{a: b}` key. Your Example 2.11 file also parses correctly with the fix.

The full `vitest run` has two failing files, `tests/json-test-suite.ts` and `tests/yaml-test-suite.ts`. They fail the same way without my change, because the test-suite submodules aren't checked out here. The other 954 tests pass.

I haven't committed anything.

</details>

### claude, muffle: pass

Files: [src/parse/parser.ts](../muffle/claude/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts), [tests/doc/parse.ts](../muffle/claude/ts-yaml-flow-key-after-blank-1/files/tests/doc/parse.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/parse/parser.ts b/src/parse/parser.ts
index 1443cc1..78b841b 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,7 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (atMapIndent && (it.sep || it.value || it.explicitKey)) {
               map.items.push({ start })
             }
             this.stack.push(bv)
diff --git a/tests/doc/parse.ts b/tests/doc/parse.ts
index 1364d0a..8fccd88 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -951,3 +951,21 @@ describe('stringKeys', () => {
     expect(doc.errors).toMatchObject([{ code: 'NON_STRING_KEY' }])
   })
 })
+
+describe('flow collection key after blank or comment line', () => {
+  for (const [name, src] of [
+    ['blank line', '1: 2\n\n[3]: 4'],
+    ['comment line', '1: 2\n# c\n[3]: 4']
+  ]) {
+    test(name, () => {
+      const doc = YAML.parseDocument(src)
+      expect(doc.errors).toHaveLength(0)
+      expect(doc.toJS({ mapAsMap: true })).toEqual(
+        new Map<unknown, unknown>([
+          [1, 2],
+          [[3], 4]
+        ])
+      )
+    })
+  }
+})
```

</details>

<details><summary>reply</summary>

I accidentally ran a stray `cat` that blocked on stdin. I'm cleaning that up, then I'll go back to the parser.

Tool output is being elided; I'll run the tokenizer directly instead.

Fixed in the parser. Now I'll add a test and run the suite.

The `IMPOSSIBLE` error is fixed. Your Example 2.11 and the smaller `1: 2\n\n[3]: 4` case both parse correctly now.

**Cause:** this was a CST parser bug in `src/parse/parser.ts`. A blank or comment line before the flow collection had already created an empty map item. When the `[` arrived, the parser pushed a second empty item. The key then landed on that second item, and the composer saw the first one as stray content.

**Fix:** the parser now adds a new item for a block value only when the previous item already has a separator, a value or an explicit key. It no longer adds one when the previous item is just leftover blank-line or comment tokens.

I checked these inputs by hand, and all parse without errors:
- a blank line before `[3]: 4`
- a comment line before `[3]: 4`
- a mixed explicit and flow-key map
- a `{a: 1}` key
- an anchored `&a [3]` key

I added regression tests for the blank-line and comment-line cases in `tests/doc/parse.ts`.

**Tests:** all 956 tests that ran pass. Two test files, `json-test-suite.ts` and `yaml-test-suite.ts`, didn't run. Their fixture directories (`tests/json-test-suite/test_parsing` and `tests/yaml-test-suite/src`) aren't checked out here, so the full YAML test suite hasn't been run against this change.

Earlier I made a stray `cat` call that wrote to `/tmp`. I deleted that file and removed my scratch directory. Nothing is committed.

The background command from earlier, the one that hung on my stray `cat`, was stopped after hitting its time limit. I'm not restarting it because the fix doesn't need it. It had only printed source lines and tried to run a tokenizer script, and I re-ran that script successfully afterward.

The fix and the tests are unaffected. The only open item is that the YAML and JSON test-suite fixtures aren't checked out here, so those two files didn't run.

</details>

### claude, hush: pass

Files: [src/parse/parser.ts](../hush/claude/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts), [tests/doc/parse.ts](../hush/claude/ts-yaml-flow-key-after-blank-1/files/tests/doc/parse.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/parse/parser.ts b/src/parse/parser.ts
index 1443cc1..5308eb7 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,10 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (
+              atMapIndent &&
+              (it.sep || it.value || it.explicitKey || it.key)
+            ) {
               map.items.push({ start })
             }
             this.stack.push(bv)
diff --git a/tests/doc/parse.ts b/tests/doc/parse.ts
index 1364d0a..7dc7611 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -951,3 +951,13 @@ describe('stringKeys', () => {
     expect(doc.errors).toMatchObject([{ code: 'NON_STRING_KEY' }])
   })
 })
+
+describe('flow collection as block map key after blank or comment line', () => {
+  for (const sep of ['\n', '\n\n', '\n# comment\n']) {
+    test(JSON.stringify(sep), () => {
+      const doc = YAML.parseDocument(`1: 2${sep}[3]: 4`)
+      expect(doc.errors).toHaveLength(0)
+      expect(doc.value.size).toBe(2)
+    })
+  }
+})
```

</details>

<details><summary>reply</summary>

Look at the flow-collection handling at line 765+ and 880+.

Adding regression test to `tests/doc/parse.ts`.

Test bug: `doc.contents` undefined in this version; use `doc.toJS`-style check.

Helper shape mismatch; simplify the assertion.

Done. `src/parse/parser.ts` `blockMap` no longer pushes a spurious empty item when a flow collection starts after a blank or comment line. I added regression tests in `tests/doc/parse.ts`; they fail without the fix and pass with it. All 957 tests pass, but `json-test-suite.ts` and `yaml-test-suite.ts` can't load here (they error on their test-suite directories), so those suites didn't run.

</details>

### claude, sloth: pass

Files: [src/parse/parser.ts](../sloth/claude/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/parse/parser.ts b/src/parse/parser.ts
index 1443cc1..b498296 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,10 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (
+              atMapIndent &&
+              !(bv.type === 'flow-collection' && !it.sep && !it.explicitKey)
+            ) {
               map.items.push({ start })
             }
             this.stack.push(bv)
```

</details>

<details><summary>reply</summary>

Let me look at the block-map handler where a flow collection starts a key.

My test expectation was wrong (the key stringifies); the parse itself works. Checking the other failures and cleaning up.

Fixed. `1: 2\n\n[3]: 4` and the Example 2.11 document now parse without an `IMPOSSIBLE` error. Parsing `1: 2\n# c\n[3]: 4` also no longer throws.

**Cause:** in `src/parse/parser.ts`, `blockMap()` pushed a new empty map item whenever a flow collection started at the map's indent. After a blank line or comment, the previous item already held those leading tokens as an empty placeholder. The new item took the key, which left an orphan item behind. The composer then reported that orphan as a map comment with trailing content.

**Fix:** a flow collection that starts a key now reuses that placeholder item when it has no `sep` and isn't an explicit key. The change is a small extra condition on the `atMapIndent` push.

**Tests:**
- The existing suite passes: 954 tests.
- `tests/json-test-suite.ts` and `tests/yaml-test-suite.ts` can't run, because their test-suite directories are missing. They fail the same way without my change.
- I checked your cases with a throwaway test and then deleted it. I added no permanent regression test, since you didn't ask for one. The `[3]` key stringifies as `"[ 3 ]"` in a plain JS object, as before.

</details>

### claude, all: pass

Files: [src/parse/parser.ts](../all/claude/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/parse/parser.ts b/src/parse/parser.ts
index 1443cc1..945337c 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,7 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (atNextItem) {
               map.items.push({ start })
             }
             this.stack.push(bv)
```

</details>

<details><summary>reply</summary>

Cause: blank line leaves empty `{start:[newline]}` item. Flow-collection key then pushes a second item. Fixing in the parser.

Done. `src/parse/parser.ts` `blockMap`: the fallback branch now pushes a new item on `atNextItem`, not `atMapIndent`, so a flow-collection key reuses the blank-line item. I checked your example, `1: 2\n\n[3]: 4`, a comment-line variant and a `{a: b}` key, and all parse correctly. 954 tests pass. The two suite files fail to load because the `tests/json-test-suite` and `tests/yaml-test-suite` directories are missing. I added no regression test.

</details>

### codex, base: FAIL

Files: [src/parse/parser.ts](../base/codex/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts), [tests/doc/parse.ts](../base/codex/ts-yaml-flow-key-after-blank-1/files/tests/doc/parse.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/parse/parser.ts b/src/parse/parser.ts
index 1443cc1..364a545 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,7 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (atMapIndent && (it.sep || it.value)) {
               map.items.push({ start })
             }
             this.stack.push(bv)
diff --git a/tests/doc/parse.ts b/tests/doc/parse.ts
index 1364d0a..5da93f0 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -20,6 +20,57 @@ if (typeof window === 'undefined') {
   }
 }
 
+describe('flow collection keys after map item separators', () => {
+  test.each(['\n', '# comment\n', '\n# comment\n'])(
+    'separator %j',
+    separator => {
+      for (const key of ['[3]', '{3: 4}']) {
+        const src = `1: 2\n${separator}${key}: 5\n`
+        const doc = YAML.parseDocument(src)
+        expect(doc.errors).toEqual([])
+        expect(doc.toJS({ mapAsMap: true })).toEqual(
+          new Map<unknown, number>([
+            [1, 2],
+            [key === '[3]' ? [3] : new Map([[3, 4]]), 5]
+          ])
+        )
+        expect(doc.value).toBeInstanceOf(YAML.YAMLMap)
+        if (doc.value instanceof YAML.YAMLMap) {
+          expect(doc.value.size).toBe(2)
+          const node = Array.from(doc.value.values.values())[1].key
+          expect(YAML.isCollection(node)).toBe(true)
+          if (YAML.isCollection(node)) {
+            expect(!!node.spaceBefore).toBe(separator.startsWith('\n'))
+            expect(node.commentBefore).toBe(
+              separator.includes('#') ? ' comment' : undefined
+            )
+          }
+        }
+      }
+    }
+  )
+
+  test('YAML 1.2 example 2.11 with an implicit flow key', () => {
+    const src = `? - Detroit Tigers
+  - Chicago cubs
+: - 2001-07-23
+
+[New York Yankees, Atlanta Braves]: [2001-07-02, 2001-08-12, 2001-08-14]
+`
+    const doc = YAML.parseDocument(src)
+    expect(doc.errors).toEqual([])
+    expect(doc.toJS({ mapAsMap: true })).toEqual(
+      new Map([
+        [['Detroit Tigers', 'Chicago cubs'], ['2001-07-23']],
+        [
+          ['New York Yankees', 'Atlanta Braves'],
+          ['2001-07-02', '2001-08-12', '2001-08-14']
+        ]
+      ])
+    )
+  })
+})
+
 describe('scalars', () => {
   test('empty block scalar at end of document', () => {
     const docs = YAML.parseAllDocuments('|\n---\nfoo')
```

</details>

<details><summary>reply</summary>

I’ll trace how the parser handles flow collection keys after blank lines and comments, add regression coverage, and run the relevant tests.

The parser was creating an extra map entry after the blank line or comment, leaving the separator in an empty entry. It now reuses that entry for the flow key, preserving the blank line and comment on the key. The reported example and the new regression cases pass; I’m running the full suite and type checks.

Fixed the parser to reuse the pending map entry when a flow collection key follows a blank line or comment, preventing the `IMPOSSIBLE` error.

Added regression tests for sequence and mapping keys, comment preservation, and your example.

Validation: 958 tests pass; type checks, lint, and formatting pass. Two external test suites could not run because their fixture directories are missing.

</details>

### codex, muffle: pass

Files: [src/parse/parser.ts](../muffle/codex/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts), [tests/doc/parse.ts](../muffle/codex/ts-yaml-flow-key-after-blank-1/files/tests/doc/parse.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/parse/parser.ts b/src/parse/parser.ts
index 1443cc1..9b18906 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,7 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (atNextItem || it.value) {
               map.items.push({ start })
             }
             this.stack.push(bv)
diff --git a/tests/doc/parse.ts b/tests/doc/parse.ts
index 1364d0a..c3a0739 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -172,6 +172,42 @@ test('long scalar value in flow map (#36)', () => {
 })
 
 describe('flow collection keys', () => {
+  test.each(['', '\n', '# comment\n', '\n# comment\n'])(
+    'flow keys after separator %j',
+    separator => {
+      for (const key of ['[3]', '{3: 4}']) {
+        const src = `1: 2\n${separator}${key}: 4\n`
+        const doc = YAML.parseDocument(src)
+        expect(doc.errors).toHaveLength(0)
+        expect(doc.toJS({ mapAsMap: true })).toEqual(
+          new Map<number | number[] | Map<number, number>, number>([
+            [1, 2],
+            [key === '[3]' ? [3] : new Map([[3, 4]]), 4]
+          ])
+        )
+        expect(String(doc).startsWith(`1: 2\n${separator}? `)).toBe(true)
+      }
+    }
+  )
+
+  test('mapping between sequences with a blank line before a flow key', () => {
+    const src = `? - Detroit Tigers
+  - Chicago cubs
+: - 2001-07-23
+
+[New York Yankees, Atlanta Braves]: [2001-07-02, 2001-08-12, 2001-08-14]
+`
+    expect(YAML.parse(src, { mapAsMap: true })).toEqual(
+      new Map([
+        [['Detroit Tigers', 'Chicago cubs'], ['2001-07-23']],
+        [
+          ['New York Yankees', 'Atlanta Braves'],
+          ['2001-07-02', '2001-08-12', '2001-08-14']
+        ]
+      ])
+    )
+  })
+
   test('block map with flow collection key as explicit key', () => {
     const doc = YAML.parseDocument<YAML.YAMLMap<YAML.YAMLMap, null>>(`? []: x`)
     expect(doc.errors).toHaveLength(0)
```

</details>

<details><summary>reply</summary>

I’ll check how the parser handles blank lines before flow collection keys, add a regression test, and run the relevant tests.

The parser creates an extra map entry when a flow key follows a blank line or comment. That leaves the separator in an empty entry, which later triggers the `IMPOSSIBLE` error. I’ve changed it to reuse the pending entry and added tests for sequence keys, mapping keys, and your full example.

Fixed the parser to reuse the pending map entry when a flow collection key follows blank lines or comments.

Added regression tests covering sequence and mapping keys, separator preservation, and your full example.

Validation: 959 tests passed, plus type checks and lint. Two external test suites could not run because their fixture directories are missing.

</details>

### codex, hush: pass

Files: [src/parse/parser.ts](../hush/codex/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts), [tests/doc/parse.ts](../hush/codex/ts-yaml-flow-key-after-blank-1/files/tests/doc/parse.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/parse/parser.ts b/src/parse/parser.ts
index 1443cc1..cdf68a6 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,7 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (atMapIndent && (it.sep || it.explicitKey)) {
               map.items.push({ start })
             }
             this.stack.push(bv)
diff --git a/tests/doc/parse.ts b/tests/doc/parse.ts
index 1364d0a..b441411 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -172,6 +172,42 @@ test('long scalar value in flow map (#36)', () => {
 })
 
 describe('flow collection keys', () => {
+  test.each(['', '\n', '# comment\n', '\n# comment\n'])(
+    'flow keys after separator %j',
+    separator => {
+      for (const key of ['[3]', '{3: 5}']) {
+        const src = `1: 2\n${separator}${key}: 4\n`
+        const doc = YAML.parseDocument<YAML.YAMLMap>(src)
+        expect(doc.errors).toHaveLength(0)
+        expect(doc.value?.size).toBe(2)
+        expect(doc.toJS({ mapAsMap: true })).toEqual(
+          new Map<unknown, number>([
+            [1, 2],
+            [key === '[3]' ? [3] : new Map([[3, 5]]), 4]
+          ])
+        )
+        expect(String(doc)).toContain(`1: 2\n${separator}? `)
+      }
+    }
+  )
+
+  test('mapping between sequences with a blank line', () => {
+    const src =
+      '? - Detroit Tigers\n  - Chicago cubs\n: - 2001-07-23\n\n' +
+      '[New York Yankees, Atlanta Braves]: [2001-07-02, 2001-08-12, 2001-08-14]\n'
+    const doc = YAML.parseDocument(src)
+    expect(doc.errors).toHaveLength(0)
+    expect(doc.toJS({ mapAsMap: true })).toEqual(
+      new Map([
+        [['Detroit Tigers', 'Chicago cubs'], ['2001-07-23']],
+        [
+          ['New York Yankees', 'Atlanta Braves'],
+          ['2001-07-02', '2001-08-12', '2001-08-14']
+        ]
+      ])
+    )
+  })
+
   test('block map with flow collection key as explicit key', () => {
     const doc = YAML.parseDocument<YAML.YAMLMap<YAML.YAMLMap, null>>(`? []: x`)
     expect(doc.errors).toHaveLength(0)
```

</details>

<details><summary>reply</summary>

Done.
Fixed flow keys after blank/comment lines; added regressions. 959 tests, types, lint passed. Two suites blocked by missing fixtures.

</details>

### codex, sloth: pass

Files: [src/parse/parser.ts](../sloth/codex/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/parse/parser.ts b/src/parse/parser.ts
index 1443cc1..9b18906 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,7 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (atNextItem || it.value) {
               map.items.push({ start })
             }
             this.stack.push(bv)
```

</details>

<details><summary>reply</summary>

I’ll trace how blank lines and comments affect flow collection keys, fix the shared parser path, then build and run the existing tests.

The parser creates an extra map item when a flow collection follows a blank or comment line, leaving the preceding item looking like a trailing comment. The fix belongs in the shared block-map parser, used by both public parsing and CST parsing. No exports, configuration, or fixtures need changes; I’ll use the existing suites and direct checks for both flow sequences and flow maps.

Fixed in [src/parse/parser.ts:701](/home/jdaddy/.cache/muffle-evals/runs/sloth/codex/ts-yaml-flow-key-after-blank-1/work/src/parse/parser.ts:701). Flow collection keys now reuse the pending map item after blank lines or comments, preventing the `IMPOSSIBLE` error.

Validated your example and 48 related cases, including nested maps and lossless CST round trips. Build, type checks, and 954 existing tests passed. Two fixture-based suites could not run because their fixture directories are missing.

</details>

### codex, all: FAIL

Files: [src/parse/parser.ts](../all/codex/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/parse/parser.ts b/src/parse/parser.ts
index 1443cc1..364a545 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,7 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (atMapIndent && (it.sep || it.value)) {
               map.items.push({ start })
             }
             this.stack.push(bv)
```

</details>

<details><summary>reply</summary>

Done.
Parser reuses pending map item before flow keys. Build, types, 954 tests, 18 repro checks passed. Two suites blocked by missing fixtures.

</details>
