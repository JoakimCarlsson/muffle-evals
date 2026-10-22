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
| claude | muffle | pass | +3/-1 | 5 | 1,290 | $0.060 |
| claude | hush | pass | +3/-1 | 0 | 610 | $0.049 |
| claude | sloth | pass | +3/-1 | 0 | 887 | $0.051 |
| claude | all | pass | +3/-1 | 0 | 669 | $0.052 |
| codex | base | pass | +3/-1 | 22 | 925 | - |
| codex | muffle | pass | +3/-1 | 20 | 746 | - |
| codex | hush | pass | +3/-1 | 12 | 620 | - |
| codex | sloth | pass | +3/-1 | 0 | 875 | - |
| codex | all | pass | +3/-1 | 0 | 579 | - |

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
index 03b1206..439d1cd 100644
--- a/tests/test_more.py
+++ b/tests/test_more.py
@@ -5074,6 +5074,11 @@ class ValueChainTests(TestCase):
         expected = [1, (2, (3,)), 'foo', ['bar', ['baz']], 'tic', 'key', obj]
         self.assertEqual(actual, expected)
 
+    def test_iteration_type_error(self):
+        # A TypeError raised while iterating must propagate
+        with self.assertRaises(TypeError):
+            list(mi.value_chain(map(len, ['ab', 'cde', 5])))
+
 
 class ProductIndexTests(TestCase):
     def test_basic(self):
```

</details>

<details><summary>reply</summary>

Fix: check iterability with `iter()` before yielding from it, so only the non-iterable check is guarded.

I fixed `value_chain` so a `TypeError` raised while it iterates an argument now reaches you. Your `map(len, ['ab', 'cde', 5])` example now raises `TypeError: object of type 'int' has no len()`.

The old code wrapped the whole `yield from value` in `try/except TypeError`. That caught errors raised partway through iteration as well as the "not iterable" case, and then yielded the half-consumed object. Now only the `iter(value)` call is guarded (`more_itertools/more.py`). Arguments that aren't iterable are still emitted as single values, and strings and bytes are still emitted as-is.

I added a regression test, `test_iteration_type_error`, in `tests/test_more.py`. The six `ValueChain` tests pass, and so do the doctests in `more.py`. I didn't run the rest of the test suite.

I made no commit.

</details>

### claude, hush: pass

Files: [more_itertools/more.py](../hush/claude/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py)

<details><summary>diff</summary>

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

</details>

<details><summary>reply</summary>

Fix: call `iter()` first, so only non-iterables are emitted as values.

Done. `value_chain` in `more_itertools/more.py` now catches `TypeError` only from `iter(value)`, so errors raised mid-iteration reach you. Your `map` example now raises, and non-iterables are still emitted as single values. I added no regression test, and `-k value_chain` selected none of the existing tests, so the suite wasn't run.

</details>

### claude, sloth: pass

Files: [more_itertools/more.py](../sloth/claude/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py)

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
```

</details>

<details><summary>reply</summary>

I fixed `value_chain` in `more_itertools/more.py`. A `TypeError` raised while iterating an argument now reaches you instead of leaving the half-consumed object in the output.

The old code wrapped `yield from value` in the `try`, so any `TypeError` raised mid-iteration was caught and the argument was yielded as a single value. Now only `iter(value)` is inside the `try`. An argument that isn't iterable is still emitted as a single value, and strings and bytes are still emitted as-is.

I checked it on your example: `list(value_chain(map(len, ['ab', 5])))` now raises `TypeError: object of type 'int' has no len()`. `value_chain(1, [2, 3], 'ab')` still gives `[1, 2, 3, 'ab']`.

The doctests in `more.py` pass (113 passed, 1 skipped). The `-k value_chain` run selected no tests, so there are no unit tests for `value_chain` in `tests` to run. I didn't add a regression test since you didn't ask for one. I haven't committed anything.

</details>

### claude, all: pass

Files: [more_itertools/more.py](../all/claude/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py)

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
```

</details>

<details><summary>reply</summary>

Done. `value_chain` in `more_itertools/more.py` now calls `iter(value)` inside the `try`, so only non-iterable arguments are emitted as single values. Errors raised during iteration now propagate.

I confirmed your `map` example now raises `TypeError: object of type 'int' has no len()`. Plain scalars and lists still behave as before. The `-k value_chain` pytest run selected no tests, so I didn't run the existing suite.

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
index 03b1206..5c829c1 100644
--- a/tests/test_more.py
+++ b/tests/test_more.py
@@ -5041,6 +5041,26 @@ class NthCombinationWithReplacementTests(TestCase):
 
 
 class ValueChainTests(TestCase):
+    def test_iteration_type_error(self):
+        values = mi.value_chain(map(len, ['ab', 'cde', 5]))
+        self.assertEqual(next(values), 2)
+        self.assertEqual(next(values), 3)
+        with self.assertRaisesRegex(TypeError, "has no len"):
+            next(values)
+
+    def test_generator_type_error(self):
+        error = TypeError('iteration failed')
+
+        def source():
+            yield 1
+            raise error
+
+        values = mi.value_chain(source())
+        self.assertEqual(next(values), 1)
+        with self.assertRaises(TypeError) as caught:
+            next(values)
+        self.assertIs(caught.exception, error)
+
     def test_empty(self):
         actual = list(mi.value_chain())
         expected = []
```

</details>

<details><summary>reply</summary>

I’ll check `value_chain` and its tests, then separate iterable detection from iteration so errors raised during iteration propagate.

Fixed `value_chain` to catch `TypeError` only when calling `iter()` on an argument. Errors raised during iteration now propagate; non-iterable arguments still yield as single values.

Added regression tests for the reported `map` case and a generator error. All 908 tests passed, with 5 skipped.

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
index 03b1206..dae7ebe 100644
--- a/tests/test_more.py
+++ b/tests/test_more.py
@@ -5041,6 +5041,18 @@ class NthCombinationWithReplacementTests(TestCase):
 
 
 class ValueChainTests(TestCase):
+    def test_iteration_type_error(self):
+        for values in (
+            map(len, ['ab', 'cde', 5]),
+            (len(value) for value in ['ab', 'cde', 5]),
+        ):
+            with self.subTest(values=values):
+                actual = mi.value_chain(values)
+                self.assertEqual(next(actual), 2)
+                self.assertEqual(next(actual), 3)
+                with self.assertRaisesRegex(TypeError, 'has no len'):
+                    next(actual)
+
     def test_empty(self):
         actual = list(mi.value_chain())
         expected = []
```

</details>

<details><summary>reply</summary>

`value_chain` needs narrower `TypeError` handling. Checking implementation and tests.


Done.
`value_chain` catches `TypeError` only from `iter()`. Iteration errors propagate. Added map/generator regression tests. Tests: 907 passed, 5 skipped.

</details>

### codex, sloth: pass

Files: [more_itertools/more.py](../sloth/codex/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py)

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
```

</details>

<details><summary>reply</summary>

I’ll check `value_chain` and its callers, then narrow the exception handling so iteration errors reach the caller while non-iterable arguments still work.

The fix only needs to reach `value_chain` in `more_itertools/more.py`. There are no internal callers to update, and the existing tests, exports, type signature, and documentation remain applicable. I’ll catch `TypeError` only when calling `iter(value)`; errors raised while consuming that iterator will then propagate.

Fixed `value_chain` to catch `TypeError` only when obtaining an iterator. Errors raised during iteration now propagate; non-iterable arguments still yield as single values.

Verified your reproduction and scalar behavior. Existing suite passed: 906 tests, 5 skipped.

Package build couldn’t run because the environment lacks `build` and `pip`.

</details>

### codex, all: pass

Files: [more_itertools/more.py](../all/codex/python-more-itertools-value-chain-typeerror-1/files/more_itertools/more.py)

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
```

</details>

<details><summary>reply</summary>

Done.
`value_chain` propagates iteration `TypeError`; noniterables stay scalar. 906 tests passed, 5 skipped. Build blocked: missing `build` and `flit`.

</details>
