# python-more-itertools-value-chain-typeerror

Source: https://github.com/more-itertools/more-itertools/pull/1251

## Prompt

> `value_chain` swallows a `TypeError` that is raised while it is iterating one of its arguments. Instead of the exception reaching me, the half-consumed object itself shows up in the output after the items it already produced:
> 
> ```python
> >>> from more_itertools import value_chain
> >>> list(value_chain(map(len, ['ab', 'cde', 5])))
> [2, 3, <map object at 0x104c6e530>]
> ```
> 
> The `TypeError: object of type 'int' has no len()` never reaches me, and the trailing item is the exhausted `map` object, which carries no data. `itertools.chain` and `more_itertools.always_iterable` both raise the `TypeError` on the same input:
> 
> ```python
> >>> list(chain(map(len, ['ab', 'cde', 5])))
> TypeError: object of type 'int' has no len()
> >>> list(always_iterable(map(len, ['ab', 'cde', 5])))
> TypeError: object of type 'int' has no len()
> ```
> 
> Any lazy argument (a generator, a `map`, a file-backed iterator) can hit this, so a real bug in my own code gets reported as a stray object in the output instead of as an exception. Arguments that are not iterable at all should of course still be emitted as single values, as documented.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [more_itertools/more.py](../../tasks/python-more-itertools-value-chain-typeerror/upstream/more_itertools/more.py), [tests/test_more.py](../../tasks/python-more-itertools-value-chain-typeerror/upstream/tests/test_more.py)

```diff
diff --git a/more_itertools/more.py b/more_itertools/more.py
index 2229563..eec094f 100755
--- a/more_itertools/more.py
+++ b/more_itertools/more.py
@@ -4414,9 +4414,11 @@ def value_chain(*args):
             yield value
             continue
         try:
-            yield from value
+            it = iter(value)
         except TypeError:
             yield value
+        else:
+            yield from it
 
 
 def product_index(element, *iterables, repeat=1):
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +3/-1 | 5 | 1,206 | $0.067 |
| claude | muffle | pass | +3/-1 | 5 | 1,096 | $0.044 |
| claude | hush | pass | +3/-1 | 4 | 1,388 | $0.072 |
| claude | sloth | pass | +3/-1 | 5 | 1,072 | $0.059 |
| claude | all | pass | +3/-1 | 4 | 1,039 | $0.064 |
| codex | base | pass | +3/-1 | 22 | 925 | - |
| codex | muffle | pass | +3/-1 | 10 | 963 | - |
| codex | hush | pass | +3/-1 | 18 | 791 | - |
| codex | sloth | pass | +3/-1 | 16 | 983 | - |
| codex | all | pass | +3/-1 | 12 | 691 | - |

### claude, base: pass

Files: [more_itertools/more.py](../base/claude/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py), [tests/test_more.py](../base/claude/python-more-itertools-value-chain-typeerror-1/files/tests/test_more.py)

<details><summary>diff</summary>

```diff
diff --git a/more_itertools/more.py b/more_itertools/more.py
index 2229563..d8891f8 100755
--- a/more_itertools/more.py
+++ b/more_itertools/more.py
@@ -4414,9 +4414,11 @@ def value_chain(*args):
             yield value
             continue
         try:
-            yield from value
+            iterator = iter(value)
         except TypeError:
             yield value
+        else:
+            yield from iterator
 
 
 def product_index(element, *iterables, repeat=1):
diff --git a/tests/test_more.py b/tests/test_more.py
index 03b1206..331a85c 100644
--- a/tests/test_more.py
+++ b/tests/test_more.py
@@ -5041,6 +5041,11 @@ class NthCombinationWithReplacementTests(TestCase):
 
 
 class ValueChainTests(TestCase):
+    def test_error_while_iterating(self):
+        it = map(len, ['ab', 'cde', 5])
+        with self.assertRaises(TypeError):
+            list(mi.value_chain(it))
+
     def test_empty(self):
         actual = list(mi.value_chain())
         expected = []
```

</details>

<details><summary>reply</summary>

`value_chain` now lets a `TypeError` raised while iterating an argument reach you. Your example `list(value_chain(map(len, ['ab', 'cde', 5])))` now raises `TypeError: object of type 'int' has no len()`. I ran the `ValueChain` tests and they pass. I did not run the full suite. The doctest run failed on a relative-import error, so the docstring examples are unchecked.

The cause was that `value_chain` wrapped `yield from value` in the `try/except TypeError`, so errors from inside the iteration were caught as if the argument weren't iterable. The fix, in `more_itertools/more.py`, calls `iter(value)` inside the `try` and does the `yield from` outside it. Arguments that really aren't iterable, such as `4`, are still emitted as single values.

I added `test_error_while_iterating` to `ValueChainTests` in `tests/test_more.py`, using your example. I haven't committed anything.

</details>

### claude, muffle: pass

Files: [more_itertools/more.py](../muffle/claude/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py), [tests/test_more.py](../muffle/claude/python-more-itertools-value-chain-typeerror-1/files/tests/test_more.py)

<details><summary>diff</summary>

```diff
diff --git a/more_itertools/more.py b/more_itertools/more.py
index 2229563..d8891f8 100755
--- a/more_itertools/more.py
+++ b/more_itertools/more.py
@@ -4414,9 +4414,11 @@ def value_chain(*args):
             yield value
             continue
         try:
-            yield from value
+            iterator = iter(value)
         except TypeError:
             yield value
+        else:
+            yield from iterator
 
 
 def product_index(element, *iterables, repeat=1):
diff --git a/tests/test_more.py b/tests/test_more.py
index 03b1206..331a85c 100644
--- a/tests/test_more.py
+++ b/tests/test_more.py
@@ -5041,6 +5041,11 @@ class NthCombinationWithReplacementTests(TestCase):
 
 
 class ValueChainTests(TestCase):
+    def test_error_while_iterating(self):
+        it = map(len, ['ab', 'cde', 5])
+        with self.assertRaises(TypeError):
+            list(mi.value_chain(it))
+
     def test_empty(self):
         actual = list(mi.value_chain())
         expected = []
```

</details>

<details><summary>reply</summary>

Only the `iter()` call should be guarded.

I fixed `value_chain` in `more_itertools/more.py` so a `TypeError` raised while iterating an argument now reaches you. Your example `list(value_chain(map(len, ['ab', 'cde', 5])))` should now raise `TypeError: object of type 'int' has no len()`, like `itertools.chain` does. I didn't run that exact line. The new regression test covers the same case, and the 6 `ValueChain` tests pass.

The old code wrapped `yield from value` in the `try/except TypeError`, so it also caught errors raised mid-iteration and yielded the half-consumed object. It now catches `TypeError` only around `iter(value)`. Arguments that aren't iterable are still emitted as single values, and strings and bytes are unchanged.

The regression test is `test_error_while_iterating` in `tests/test_more.py`. I only ran the `ValueChain` tests, not the full suite. I also tried running the module doctests, but that failed with a relative-import error, so they weren't checked.

</details>

### claude, hush: pass

Files: [more_itertools/more.py](../hush/claude/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py), [tests/test_more.py](../hush/claude/python-more-itertools-value-chain-typeerror-1/files/tests/test_more.py)

<details><summary>diff</summary>

```diff
diff --git a/more_itertools/more.py b/more_itertools/more.py
index 2229563..d8891f8 100755
--- a/more_itertools/more.py
+++ b/more_itertools/more.py
@@ -4414,9 +4414,11 @@ def value_chain(*args):
             yield value
             continue
         try:
-            yield from value
+            iterator = iter(value)
         except TypeError:
             yield value
+        else:
+            yield from iterator
 
 
 def product_index(element, *iterables, repeat=1):
diff --git a/tests/test_more.py b/tests/test_more.py
index 03b1206..99e6b94 100644
--- a/tests/test_more.py
+++ b/tests/test_more.py
@@ -5061,6 +5061,10 @@ class ValueChainTests(TestCase):
         expected = [1, 2, 3, 4]
         self.assertEqual(actual, expected)
 
+    def test_lazy_type_error(self):
+        with self.assertRaises(TypeError):
+            list(mi.value_chain(map(len, ['ab', 'cde', 5])))
+
     def test_complex(self):
         obj = object()
         actual = list(
```

</details>

<details><summary>reply</summary>

Fixing duplicate line I added in test, then run tests.

Done. `value_chain` in `more_itertools/more.py` now calls `iter(value)` inside the `try`, so only a non-iterable argument is emitted as a single value. A `TypeError` raised while iterating now propagates. I added `test_lazy_type_error` in `tests/test_more.py`. The 6 `ValueChain` tests pass; I didn't run the rest of the suite. Nothing is committed.

</details>

### claude, sloth: pass

Files: [more_itertools/more.py](../sloth/claude/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py), [tests/test_more.py](../sloth/claude/python-more-itertools-value-chain-typeerror-1/files/tests/test_more.py)

<details><summary>diff</summary>

```diff
diff --git a/more_itertools/more.py b/more_itertools/more.py
index 2229563..d8891f8 100755
--- a/more_itertools/more.py
+++ b/more_itertools/more.py
@@ -4414,9 +4414,11 @@ def value_chain(*args):
             yield value
             continue
         try:
-            yield from value
+            iterator = iter(value)
         except TypeError:
             yield value
+        else:
+            yield from iterator
 
 
 def product_index(element, *iterables, repeat=1):
diff --git a/tests/test_more.py b/tests/test_more.py
index 03b1206..9640a97 100644
--- a/tests/test_more.py
+++ b/tests/test_more.py
@@ -5061,6 +5061,11 @@ class ValueChainTests(TestCase):
         expected = [1, 2, 3, 4]
         self.assertEqual(actual, expected)
 
+    def test_iteration_type_error(self):
+        iterable = map(len, ['ab', 'cde', 5])
+        with self.assertRaises(TypeError):
+            list(mi.value_chain(iterable))
+
     def test_complex(self):
         obj = object()
         actual = list(
```

</details>

<details><summary>reply</summary>

Fixed: `value_chain` now raises the `TypeError` from a lazy argument instead of emitting the half-consumed object. I ran only the `value_chain` tests (6 passed), not the full suite.

The cause was that `value_chain` wrapped `yield from value` in a `try/except TypeError`. That caught errors raised partway through iteration as well as the "not iterable" case, so it yielded the exhausted `map`. It now calls `iter(value)` inside the `try`, and only a failure there makes the argument a single value. Arguments that aren't iterable at all are still emitted as-is, and errors while iterating now propagate. The change is in `more_itertools/more.py`.

I added `test_iteration_type_error` to `ValueChainTests` in `tests/test_more.py`, using your `map(len, ['ab', 'cde', 5])` example.

I haven't committed anything.

</details>

### claude, all: pass

Files: [more_itertools/more.py](../all/claude/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py), [tests/test_more.py](../all/claude/python-more-itertools-value-chain-typeerror-1/files/tests/test_more.py)

<details><summary>diff</summary>

```diff
diff --git a/more_itertools/more.py b/more_itertools/more.py
index 2229563..d8891f8 100755
--- a/more_itertools/more.py
+++ b/more_itertools/more.py
@@ -4414,9 +4414,11 @@ def value_chain(*args):
             yield value
             continue
         try:
-            yield from value
+            iterator = iter(value)
         except TypeError:
             yield value
+        else:
+            yield from iterator
 
 
 def product_index(element, *iterables, repeat=1):
diff --git a/tests/test_more.py b/tests/test_more.py
index 03b1206..cee99a7 100644
--- a/tests/test_more.py
+++ b/tests/test_more.py
@@ -5056,6 +5056,10 @@ class ValueChainTests(TestCase):
         expected = [b'bar', 1, 2, 3, 4, 'key']
         self.assertEqual(actual, expected)
 
+    def test_error_while_iterating(self):
+        with self.assertRaises(TypeError):
+            list(mi.value_chain(1, map(len, ['ab', 'cde', 5])))
+
     def test_empty_lists(self):
         actual = list(mi.value_chain(1, 2, [], [3, 4]))
         expected = [1, 2, 3, 4]
```

</details>

<details><summary>reply</summary>

Done. `value_chain` in `more_itertools/more.py` now calls `iter(value)` inside the `try`, so only non-iterables are emitted as single values. A `TypeError` raised mid-iteration now propagates. I added `test_error_while_iterating`, and the 6 `ValueChain` tests pass. I didn't run the rest of the suite.

</details>

### codex, base: pass

Files: [more_itertools/more.py](../base/codex/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py), [tests/test_more.py](../base/codex/python-more-itertools-value-chain-typeerror-1/files/tests/test_more.py)

<details><summary>diff</summary>

```diff
diff --git a/more_itertools/more.py b/more_itertools/more.py
index 2229563..d8891f8 100755
--- a/more_itertools/more.py
+++ b/more_itertools/more.py
@@ -4414,9 +4414,11 @@ def value_chain(*args):
             yield value
             continue
         try:
-            yield from value
+            iterator = iter(value)
         except TypeError:
             yield value
+        else:
+            yield from iterator
 
 
 def product_index(element, *iterables, repeat=1):
diff --git a/tests/test_more.py b/tests/test_more.py
index 03b1206..862d7e3 100644
--- a/tests/test_more.py
+++ b/tests/test_more.py
@@ -5041,6 +5041,28 @@ class NthCombinationWithReplacementTests(TestCase):
 
 
 class ValueChainTests(TestCase):
+    def test_iteration_type_error(self):
+        for values, expected in [(['ab', 'cde', 5], [2, 3]), ([5], [])]:
+            with self.subTest(values=values):
+                iterator = mi.value_chain(map(len, values), 'after')
+                for value in expected:
+                    self.assertEqual(next(iterator), value)
+                with self.assertRaisesRegex(TypeError, 'has no len'):
+                    next(iterator)
+
+    def test_generator_type_error(self):
+        error = TypeError('iteration failed')
+
+        def source():
+            yield 1
+            raise error
+
+        iterator = mi.value_chain(source(), 'after')
+        self.assertEqual(next(iterator), 1)
+        with self.assertRaises(TypeError) as caught:
+            next(iterator)
+        self.assertIs(caught.exception, error)
+
     def test_empty(self):
         actual = list(mi.value_chain())
         expected = []
```

</details>

<details><summary>reply</summary>

I’ll check `value_chain` and its tests, then make sure iteration errors propagate while non-iterable arguments still pass through as single values.

The fix now catches `TypeError` only when obtaining an iterator. Errors raised while consuming it propagate. The regression tests pass for both `map` and a generator, including failure before the first item; the full suite is running.

Fixed `value_chain` to catch `TypeError` only when obtaining an iterator. Errors raised during iteration now propagate, while non-iterable arguments still appear as single values.

Added regression tests for failing `map` and generator arguments. All 908 tests passed, with 5 skipped.

</details>

### codex, muffle: pass

Files: [more_itertools/more.py](../muffle/codex/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py), [tests/test_more.py](../muffle/codex/python-more-itertools-value-chain-typeerror-1/files/tests/test_more.py)

<details><summary>diff</summary>

```diff
diff --git a/more_itertools/more.py b/more_itertools/more.py
index 2229563..d8891f8 100755
--- a/more_itertools/more.py
+++ b/more_itertools/more.py
@@ -4414,9 +4414,11 @@ def value_chain(*args):
             yield value
             continue
         try:
-            yield from value
+            iterator = iter(value)
         except TypeError:
             yield value
+        else:
+            yield from iterator
 
 
 def product_index(element, *iterables, repeat=1):
diff --git a/tests/test_more.py b/tests/test_more.py
index 03b1206..fb94097 100644
--- a/tests/test_more.py
+++ b/tests/test_more.py
@@ -5041,6 +5041,16 @@ class NthCombinationWithReplacementTests(TestCase):
 
 
 class ValueChainTests(TestCase):
+    def test_iteration_type_error(self):
+        for values, expected in ((['ab', 'cde', 5], [2, 3]), ([5], [])):
+            with self.subTest(values=values):
+                iterator = mi.value_chain(map(len, values), 'after')
+                for value in expected:
+                    self.assertEqual(next(iterator), value)
+                with self.assertRaises(TypeError):
+                    next(iterator)
+                self.assertEqual(list(iterator), [])
+
     def test_empty(self):
         actual = list(mi.value_chain())
         expected = []
```

</details>

<details><summary>reply</summary>

I’ll check `value_chain` and its tests, then adjust it so iteration errors propagate while non-iterable arguments remain single values.

Fixed `value_chain` to catch `TypeError` only when obtaining an iterator. Errors raised during iteration now propagate; non-iterable arguments still yield as single values.

Added regression coverage for failures before and after yielding items. All 907 tests pass (5 skipped).

</details>

### codex, hush: pass

Files: [more_itertools/more.py](../hush/codex/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py), [tests/test_more.py](../hush/codex/python-more-itertools-value-chain-typeerror-1/files/tests/test_more.py)

<details><summary>diff</summary>

```diff
diff --git a/more_itertools/more.py b/more_itertools/more.py
index 2229563..d8891f8 100755
--- a/more_itertools/more.py
+++ b/more_itertools/more.py
@@ -4414,9 +4414,11 @@ def value_chain(*args):
             yield value
             continue
         try:
-            yield from value
+            iterator = iter(value)
         except TypeError:
             yield value
+        else:
+            yield from iterator
 
 
 def product_index(element, *iterables, repeat=1):
diff --git a/tests/test_more.py b/tests/test_more.py
index 03b1206..96c900c 100644
--- a/tests/test_more.py
+++ b/tests/test_more.py
@@ -5041,6 +5041,24 @@ class NthCombinationWithReplacementTests(TestCase):
 
 
 class ValueChainTests(TestCase):
+    def test_iteration_type_error(self):
+        def generator():
+            yield 2
+            yield 3
+            raise TypeError('iteration failed')
+
+        for source in (map(len, ['ab', 'cde', 5]), generator()):
+            with self.subTest(source=source):
+                actual = mi.value_chain(source, 'unreached')
+                self.assertEqual(next(actual), 2)
+                self.assertEqual(next(actual), 3)
+                with self.assertRaises(TypeError):
+                    next(actual)
+
+    def test_immediate_iteration_type_error(self):
+        with self.assertRaises(TypeError):
+            list(mi.value_chain(map(len, [5])))
+
     def test_empty(self):
         actual = list(mi.value_chain())
         expected = []
```

</details>

<details><summary>reply</summary>

`value_chain` must catch `TypeError` from `iter()`, then let iteration errors propagate.

Done.
`value_chain` now propagates iteration errors; noniterables remain single values. Regression tests added. Suite: 908 tests, 5 skipped.

</details>

### codex, sloth: pass

Files: [more_itertools/more.py](../sloth/codex/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py), [tests/test_more.py](../sloth/codex/python-more-itertools-value-chain-typeerror-1/files/tests/test_more.py)

<details><summary>diff</summary>

```diff
diff --git a/more_itertools/more.py b/more_itertools/more.py
index 2229563..d8891f8 100755
--- a/more_itertools/more.py
+++ b/more_itertools/more.py
@@ -4414,9 +4414,11 @@ def value_chain(*args):
             yield value
             continue
         try:
-            yield from value
+            iterator = iter(value)
         except TypeError:
             yield value
+        else:
+            yield from iterator
 
 
 def product_index(element, *iterables, repeat=1):
diff --git a/tests/test_more.py b/tests/test_more.py
index 03b1206..92eddfe 100644
--- a/tests/test_more.py
+++ b/tests/test_more.py
@@ -5041,6 +5041,22 @@ class NthCombinationWithReplacementTests(TestCase):
 
 
 class ValueChainTests(TestCase):
+    def test_iteration_type_error(self):
+        """Propagate iteration errors before or after yielding items."""
+        for values in ([5], ['ab', 'cde', 5]):
+            for iterable in (
+                map(len, values),
+                (len(value) for value in values),
+            ):
+                with self.subTest(values=values, iterable=iterable):
+                    result = mi.value_chain(iterable)
+                    for value in values[:-1]:
+                        self.assertEqual(next(result), len(value))
+                    with self.assertRaisesRegex(
+                        TypeError, "object of type 'int' has no len"
+                    ):
+                        next(result)
+
     def test_empty(self):
         actual = list(mi.value_chain())
         expected = []
```

</details>

<details><summary>reply</summary>

I’ll check `value_chain` and its tests, then narrow the exception handling so iteration errors propagate while non-iterable arguments remain single values.

The `try` block currently covers both obtaining the iterator and consuming it, so it catches errors from either step. The fix needs only the shared implementation and a regression test; callers, exports, type hints, fixtures, and configuration need no changes. I’ll preserve the existing scalar behavior and test errors both before and after items have been yielded.

Fixed `value_chain` to catch `TypeError` only when obtaining an iterator. Errors raised during iteration now propagate; non-iterable arguments still yield as single values.

Added regression coverage for maps and generators failing before or after yielding items.

Validation: 907 tests passed, 5 skipped. Package build was blocked by missing `pip` and `flit_core`.

</details>

### codex, all: pass

Files: [more_itertools/more.py](../all/codex/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py), [tests/test_more.py](../all/codex/python-more-itertools-value-chain-typeerror-1/files/tests/test_more.py)

<details><summary>diff</summary>

```diff
diff --git a/more_itertools/more.py b/more_itertools/more.py
index 2229563..d8891f8 100755
--- a/more_itertools/more.py
+++ b/more_itertools/more.py
@@ -4414,9 +4414,11 @@ def value_chain(*args):
             yield value
             continue
         try:
-            yield from value
+            iterator = iter(value)
         except TypeError:
             yield value
+        else:
+            yield from iterator
 
 
 def product_index(element, *iterables, repeat=1):
diff --git a/tests/test_more.py b/tests/test_more.py
index 03b1206..e6efbcf 100644
--- a/tests/test_more.py
+++ b/tests/test_more.py
@@ -5041,6 +5041,18 @@ class NthCombinationWithReplacementTests(TestCase):
 
 
 class ValueChainTests(TestCase):
+    def test_iteration_type_error(self):
+        """Propagate iteration errors before or after yielding items."""
+        for values in ([5], ['ab', 'cde', 5]):
+            with self.subTest(values=values):
+                result = mi.value_chain(map(len, values))
+                for value in values[:-1]:
+                    self.assertEqual(next(result), len(value))
+                with self.assertRaisesRegex(
+                    TypeError, "object of type 'int' has no len"
+                ):
+                    next(result)
+
     def test_empty(self):
         actual = list(mi.value_chain())
         expected = []
```

</details>

<details><summary>reply</summary>

Done.
`value_chain` propagates iteration `TypeError`; scalars unchanged. Regression test added. 907 tests passed, 5 skipped. Build blocked: missing `build` module.

</details>
