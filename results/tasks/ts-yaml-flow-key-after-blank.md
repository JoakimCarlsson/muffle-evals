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
| claude | muffle | pass | +1/-1 | 13 | 3,539 | $0.122 |
| claude | hush | pass | +1/-1 | 17 | 2,738 | $0.116 |
| claude | sloth | pass | +1/-1 | 8 | 4,363 | $0.138 |
| claude | all | pass | +1/-1 | 14 | 3,815 | $0.145 |
| codex | base | **FAIL** | +1/-1 | 51 | 2,442 | - |
| codex | muffle | pass | +1/-1 | 43 | 2,069 | - |
| codex | hush | pass | +1/-1 | 43 | 1,955 | - |
| codex | sloth | pass | +1/-1 | 36 | 1,969 | - |
| codex | all | pass | +1/-1 | 35 | 1,562 | - |

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
index 1443cc1..08a2397 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,7 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (atMapIndent && (it.sep || it.explicitKey || it.value)) {
               map.items.push({ start })
             }
             this.stack.push(bv)
diff --git a/tests/doc/parse.ts b/tests/doc/parse.ts
index 1364d0a..5b5cdd3 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -269,6 +269,19 @@ test('stream end after : indicator (#120)', () => {
   })
 })
 
+test('flow collection key after blank or comment line', () => {
+  for (const src of ['1: 2\n\n[3]: 4', '1: 2\n# c\n[3]: 4']) {
+    const doc = YAML.parseDocument(src)
+    expect(doc.errors).toHaveLength(0)
+    expect(doc.toJS({ mapAsMap: true })).toEqual(
+      new Map<unknown, unknown>([
+        [1, 2],
+        [[3], 4]
+      ])
+    )
+  }
+})
+
 test('comment between key & : in flow collection (#149)', () => {
   const src1 = '{"a"\n#c\n:1}'
   expect(YAML.parse(src1)).toEqual({ a: 1 })
```

</details>

<details><summary>reply</summary>

Found it: the parser puts the blank line in its own map item and then starts a second item for the flow key. I'm reading `blockMap` in the parser to see why.

Fixed. Your example, `1: 2\n\n[3]: 4`, and the version with a comment line instead of the blank line now parse with no errors.

**Cause:** the bug was in the CST parser, not the composer. When a block map got a flow collection key after a blank or comment line, `blockMap` in `src/parse/parser.ts` always started a new map item for the key. The empty item holding the blank line was left behind. The composer then took that leftover item for trailing map-comment content and raised `IMPOSSIBLE`.

**Fix:** at `src/parse/parser.ts:701`, a new item is now pushed only when the current item already has a separator, an explicit key or a value. Otherwise the key goes into the current item, which is how scalar keys already behave.

**Verification:**
- **Spec example:** I ran Example 2.11 (mapping between sequences) with a blank line before the flow-key line. It parses correctly, as does `{a: 1}` as a key.
- **New test:** I added one in `tests/doc/parse.ts` covering the blank-line and comment-line cases.
- **Test run:** 954 tests pass. The two suites that failed to load, `json-test-suite` and `yaml-test-suite`, need their test-data directories, which aren't in this checkout, so those cases did not run.

Nothing is committed.

</details>

### claude, hush: pass

Files: [src/parse/parser.ts](../hush/claude/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts), [tests/doc/parse.ts](../hush/claude/ts-yaml-flow-key-after-blank-1/files/tests/doc/parse.ts)

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
index 1364d0a..8ad476a 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -951,3 +951,20 @@ describe('stringKeys', () => {
     expect(doc.errors).toMatchObject([{ code: 'NON_STRING_KEY' }])
   })
 })
+
+describe('flow collection key after blank line or comment', () => {
+  test('blank line', () => {
+    const doc = YAML.parseDocument('1: 2\n\n[3]: 4\n')
+    expect(doc.errors).toHaveLength(0)
+    expect(doc.toJS({ mapAsMap: true })).toMatchObject(
+      new Map<unknown, unknown>([
+        [1, 2],
+        [[3], 4]
+      ])
+    )
+  })
+  test('comment line', () => {
+    const doc = YAML.parseDocument('1: 2\n# c\n{ a: 3 }: 4\n')
+    expect(doc.errors).toHaveLength(0)
+  })
+})
```

</details>

<details><summary>reply</summary>

Saying it: found cause in `src/parse/parser.ts` default case. Flow key after blank line pushes a new empty item, orphaning the blank-line item. Fixing.

Done. In `src/parse/parser.ts`, a flow-collection key after a blank or comment line no longer starts a second empty map item. That empty item caused the `IMPOSSIBLE` error. I added two regression tests to `tests/doc/parse.ts`.

Your Example 2.11 YAML wasn't run verbatim. The tests cover `1: 2\n\n[3]: 4` and a comment-line variant, and they pass along with the 955 other tests. `tests/yaml-test-suite.ts` and one other test file fail to load because the test-suite files under `tests/yaml-test-suite/src` are missing here, so they didn't run.

</details>

### claude, sloth: pass

Files: [src/parse/parser.ts](../sloth/claude/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts), [tests/doc/parse.ts](../sloth/claude/ts-yaml-flow-key-after-blank-1/files/tests/doc/parse.ts)

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
diff --git a/tests/doc/parse.ts b/tests/doc/parse.ts
index 1364d0a..4cac92a 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -219,6 +219,14 @@ describe('flow collection keys', () => {
     )
   })
 
+  test('flow collection as block map key after blank line or comment', () => {
+    for (const gap of ['\n', '# c\n']) {
+      const doc = YAML.parseDocument(`1: 2\n${gap}[3]: 4`)
+      expect(doc.errors).toHaveLength(0)
+      expect(doc.toJS()).toMatchObject({ 1: 2, '[ 3 ]': 4 })
+    }
+  })
+
   test('empty scalar as last flow collection value (#550)', () => {
     const doc = YAML.parseDocument<YAML.YAMLMap, false>('{c:}')
     expect(doc.value).toMatchObject(_map({ c: { value: null } }))
```

</details>

<details><summary>reply</summary>

Still tracing where the blank-line item gets split from the flow key in the parser.

Line range was off; applying the edit directly.

Parser fix works; only my assertion's expected key was wrong.

The `IMPOSSIBLE` error is fixed. A flow collection can now be a block map key after a blank line or a comment line.

**Cause:** In `src/parse/parser.ts`, a blank or comment line before a key becomes its own start-only item in the block map. When the next token was a flow collection (`[` or `{`), the parser added a new item at the map's indent without checking whether that blank item was still open. The blank item stayed in the map as an orphan, and the composer then raised `IMPOSSIBLE`. Scalar keys already avoided this by using the open item.

**Fix:** In `blockMap`, I changed `else if (atMapIndent)` to `else if (atNextItem)`. A new item is now pushed only after a completed item, not onto a blank start-only one.

**Test:** I added a case to `tests/doc/parse.ts` covering both a blank line and a `# c` comment line before `[3]: 4`.

**Results:** 955 tests pass. `tests/json-test-suite.ts` and `tests/yaml-test-suite.ts` fail to load because their fixture directories (`tests/json-test-suite/test_parsing` and `tests/yaml-test-suite/src`) are missing. They failed the same way before my change.

I did not run your exact Example 2.11 file. My last check on it didn't run (a Node error), and I didn't retry it. The `1: 2\n\n[3]: 4` case from your report is covered by the new test.

</details>

### claude, all: pass

Files: [src/parse/parser.ts](../all/claude/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts), [tests/doc/parse.ts](../all/claude/ts-yaml-flow-key-after-blank-1/files/tests/doc/parse.ts)

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
index 1364d0a..311a276 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -183,6 +183,20 @@ describe('flow collection keys', () => {
     }
   })
 
+  test.each(['\n', '# c\n'])(
+    'flow collection key after blank or comment line %j',
+    gap => {
+      const doc = YAML.parseDocument(`1: 2\n${gap}[3]: 4\n`)
+      expect(doc.errors).toHaveLength(0)
+      expect(doc.toJS({ mapAsMap: true })).toEqual(
+        new Map<unknown, unknown>([
+          [1, 2],
+          [[3], 4]
+        ])
+      )
+    }
+  )
+
   test('flow collection as first block map key (redhat-developer/vscode-yaml#712)', () => {
     const doc = YAML.parseDocument(source`
       a:
```

</details>

<details><summary>reply</summary>

Tracing the CST: the blank line becomes its own item. Reading the flow-collection start handler next.

Adding a regression test, then running the suite.

Done. In `src/parse/parser.ts` `blockMap`, a flow collection key no longer gets a second item after a blank or comment line. I added a regression test in `tests/doc/parse.ts` that covers both cases.

All 956 tests pass. The `json-test-suite` and `yaml-test-suite` files fail to load because their submodule directories are missing here, so they didn't run. I didn't run your Example 2.11 file directly.

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
index 1364d0a..4c6761f 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -20,6 +20,49 @@ if (typeof window === 'undefined') {
   }
 }
 
+describe('flow collection keys in block maps', () => {
+  test.each(['[3]', '{ a: 3 }'])('%s after blank lines or comments', key => {
+    for (const before of ['', '\n', '# comment\n', '\n# comment\n\n']) {
+      const src = `1: 2\n${before}${key}: 4\n`
+      const doc = YAML.parseDocument(src)
+      expect(doc.errors).toHaveLength(0)
+      expect(doc.toJS({ mapAsMap: true })).toEqual(
+        new Map([
+          [1, 2],
+          [YAML.parse(key, { mapAsMap: true }), 4]
+        ])
+      )
+      const items = Array.from((doc.value as YAML.YAMLMap).values.values())
+      expect(items).toHaveLength(2)
+      if (before.includes('#'))
+        expect(items[1].key).toHaveProperty(
+          'commentBefore',
+          before.endsWith('\n\n') ? ' comment\n' : ' comment'
+        )
+      if (before.startsWith('\n'))
+        expect(items[1].key).toHaveProperty('spaceBefore', true)
+    }
+  })
+
+  test('Example 2.11 with an implicit flow sequence key', () => {
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
+})
+
 describe('scalars', () => {
   test('empty block scalar at end of document', () => {
     const docs = YAML.parseAllDocuments('|\n---\nfoo')
```

</details>

<details><summary>reply</summary>

I’ll check how blank lines and comments are handled before flow collection keys, fix the parser, and add regression coverage.

The parser creates an extra map item when a flow key follows a blank line or comment. That leaves the preceding item looking like a trailing map comment, which triggers `IMPOSSIBLE`. The fix reuses the pending item and preserves its whitespace and comments.

Fixed the parser to reuse the pending map item when a flow collection key follows blank lines or comments, preventing the `IMPOSSIBLE` error.

Added regression coverage for sequence and mapping keys, comment preservation, and your spec example.

Validation: 957 tests passed; type checks and lint passed. Two external test suites could not run because their fixture directories are missing.

</details>

### codex, hush: pass

Files: [src/parse/parser.ts](../hush/codex/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts), [tests/doc/parse.ts](../hush/codex/ts-yaml-flow-key-after-blank-1/files/tests/doc/parse.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/parse/parser.ts b/src/parse/parser.ts
index 1443cc1..910c67e 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,7 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (atNextItem || (atMapIndent && it.value)) {
               map.items.push({ start })
             }
             this.stack.push(bv)
diff --git a/tests/doc/parse.ts b/tests/doc/parse.ts
index 1364d0a..663710d 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -611,6 +611,49 @@ describe('handling complex keys', () => {
   beforeEach(() => mockWarn.mockReset().mockImplementation(() => {}))
   afterAll(() => mockWarn.mockRestore())
 
+  test.each(['\n', '\n\n', '\n# comment\n', '\n\n# comment\n'])(
+    'flow keys after %j',
+    separator => {
+      for (const key of ['[3]', '{3: 4}']) {
+        const doc = YAML.parseDocument(`1: 2${separator}${key}: 5`)
+        expect(doc.errors).toEqual([])
+        expect(doc.toJS({ mapAsMap: true })).toEqual(
+          new Map<unknown, number>([
+            [1, 2],
+            [key === '[3]' ? [3] : new Map([[3, 4]]), 5]
+          ])
+        )
+        const node = doc.value as YAML.YAMLMap
+        const keyNode = Array.from(node.values.values())[1].key as YAML.Node
+        expect(keyNode.spaceBefore).toBe(
+          separator.startsWith('\n\n') || undefined
+        )
+        expect(keyNode.commentBefore).toBe(
+          separator.includes('#') ? ' comment' : undefined
+        )
+      }
+    }
+  )
+
+  test('mapping between sequences with a blank line', () => {
+    const src = source`
+      ? - Detroit Tigers
+        - Chicago cubs
+      : - 2001-07-23
+
+      [New York Yankees, Atlanta Braves]: [2001-07-02, 2001-08-12, 2001-08-14]
+    `
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
   test('emit warning when casting key in collection to string as JS Object key', () => {
     const doc = YAML.parseDocument('[foo]: bar', { prettyErrors: false })
     expect(doc.warnings).toHaveLength(0)
```

</details>

<details><summary>reply</summary>

Done.
Flow keys reuse pending map items, preserving blanks/comments. Regression tests, types, lint pass. Full suite blocked by missing fixtures; 958 tests passed.

</details>

### codex, sloth: pass

Files: [src/parse/parser.ts](../sloth/codex/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts), [tests/doc/parse.ts](../sloth/codex/ts-yaml-flow-key-after-blank-1/files/tests/doc/parse.ts)

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
diff --git a/tests/doc/parse.ts b/tests/doc/parse.ts
index 1364d0a..f68aa24 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -172,6 +172,42 @@ test('long scalar value in flow map (#36)', () => {
 })
 
 describe('flow collection keys', () => {
+  test('flow key after blank lines or comments', () => {
+    for (const before of ['', '\n', '# comment\n', '\n# comment\n\n']) {
+      for (const key of ['[3]', '{3: 4}']) {
+        const src = `1: 2\n${before}${key}: 4\n`
+        const doc = YAML.parseDocument<YAML.YAMLMap>(src, {
+          keepSourceTokens: true
+        })
+        expect(doc.errors).toHaveLength(0)
+        expect(doc.toJS({ mapAsMap: true })).toEqual(
+          new Map<unknown, number>([
+            [1, 2],
+            [key === '[3]' ? [3] : new Map([[3, 4]]), 4]
+          ])
+        )
+        expect(YAML.CST.stringify(doc.value.srcToken!)).toBe(src)
+      }
+    }
+
+    const src = source`
+      ? - Detroit Tigers
+        - Chicago cubs
+      : - 2001-07-23
+
+      [New York Yankees, Atlanta Braves]: [2001-07-02, 2001-08-12, 2001-08-14]
+    `
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

I’ll trace how block maps handle blank lines before flow collection keys, add regression coverage, and run the build and tests.

The parser creates an extra map item when a flow key follows blank lines or comments. That leaves the spacing in a comment-only item, which later triggers the `IMPOSSIBLE` error. I’ll fix the item creation condition and add tests in the existing flow-key group; no API, export, config, or fixture changes are needed.

The fix passes the reported example and tests for sequence and mapping keys after blank lines or comments. The build and type checks pass, and all 955 available tests pass. Two external test suites could not run because their fixture directories are missing from this checkout.

Fixed the parser to reuse the pending map item when a flow collection key follows blank lines or comments.

Added regression coverage for both flow key types and your YAML spec example.

Build, type checks, lint, and all 955 available tests pass. Two external suites could not run because their fixture directories are missing.

</details>

### codex, all: pass

Files: [src/parse/parser.ts](../all/codex/ts-yaml-flow-key-after-blank-1/files/src/parse/parser.ts), [tests/doc/parse.ts](../all/codex/ts-yaml-flow-key-after-blank-1/files/tests/doc/parse.ts)

<details><summary>diff</summary>

```diff
diff --git a/src/parse/parser.ts b/src/parse/parser.ts
index 1443cc1..08a2397 100644
--- a/src/parse/parser.ts
+++ b/src/parse/parser.ts
@@ -698,7 +698,7 @@ export class Parser {
                 })
                 return
               }
-            } else if (atMapIndent) {
+            } else if (atMapIndent && (it.sep || it.explicitKey || it.value)) {
               map.items.push({ start })
             }
             this.stack.push(bv)
diff --git a/tests/doc/parse.ts b/tests/doc/parse.ts
index 1364d0a..833565a 100644
--- a/tests/doc/parse.ts
+++ b/tests/doc/parse.ts
@@ -172,6 +172,41 @@ test('long scalar value in flow map (#36)', () => {
 })
 
 describe('flow collection keys', () => {
+  test.each(['', '\n', '# comment\n', '\n# comment\n\n'])(
+    'flow keys after separation %j',
+    separation => {
+      for (const key of ['[3]', '{ a: 3 }']) {
+        const src = `1: 2\n${separation}${key}: 4\n`
+        const doc = YAML.parseDocument(src)
+        expect(doc.errors).toHaveLength(0)
+        expect(doc.toJS({ mapAsMap: true })).toEqual(
+          new Map<unknown, number>([
+            [1, 2],
+            [key === '[3]' ? [3] : new Map([['a', 3]]), 4]
+          ])
+        )
+        expect(String(doc).startsWith(`1: 2\n${separation}? `)).toBe(true)
+      }
+    }
+  )
+
+  test('mapping between sequences with a blank line', () => {
+    const doc = YAML.parseDocument(
+      '? - Detroit Tigers\n  - Chicago cubs\n: - 2001-07-23\n\n' +
+        '[New York Yankees, Atlanta Braves]: [2001-07-02, 2001-08-12, 2001-08-14]\n'
+    )
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
Fixed flow keys after blank/comment lines. Build, types, lint, 959 tests passed; two suites blocked by missing fixtures.

</details>
