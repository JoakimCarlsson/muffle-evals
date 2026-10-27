# python-attrs-pre-init-defaults

Source: https://github.com/python-attrs/attrs/pull/1428

## Prompt

> Defaults are passed to `__attrs_pre_init__` instead of the values given to `__init__`.
> 
> The documentation says:
> 
> > If `__attrs_pre_init__` takes more than the `self` argument, the attrs-generated `__init__` will call it with the same arguments it received itself.
> 
> However, if those attributes have default values (and are not keyword-only), their default value is passed to `__attrs_pre_init__` even when I pass a value for them:
> 
> ```python
> import attrs
> 
> @attrs.define
> class Example:
>     val1: int
>     val2: int = 100
>     val3: dict = attrs.field(factory=dict)
>     val4: int = attrs.field(kw_only=True)
>     val5: int = attrs.field(default=100, kw_only=True)
> 
>     def __attrs_pre_init__(self, val1, val2, val3, val4, val5):
>         print("val1", val1)
>         print("val2", val2)
>         print("val3", val3)
>         print("val4", val4)
>         print("val5", val5)
> 
> e = Example(val1=200, val2=200, val3={"blah": "blah"}, val4=200, val5=200)
> ```
> 
> Output:
> 
> ```
> val1 200
> val2 100              # <-- Incorrect
> val3 _Nothing.NOTHING # <-- Incorrect
> val4 200
> val5 200
> ```
> 
> I expected `__attrs_pre_init__` to get 200 for `val2` and `{"blah": "blah"}` for `val3`, the values I passed.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [changelog.d/1427.change.md](../../tasks/python-attrs-pre-init-defaults/upstream/changelog.d/1427.change.md), [src/attr/_make.py](../../tasks/python-attrs-pre-init-defaults/upstream/src/attr/_make.py), [tests/test_make.py](../../tasks/python-attrs-pre-init-defaults/upstream/tests/test_make.py)

```diff
diff --git a/changelog.d/1427.change.md b/changelog.d/1427.change.md
new file mode 100644
index 0000000..4c60e88
--- /dev/null
+++ b/changelog.d/1427.change.md
@@ -0,0 +1 @@
+Values passed to the `__init__()` method of `attrs` classes are now correctly passed to `__attrs_pre_init__()` instead of their default values (in cases where *kw_only* was not specified).
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..4b3ec7d 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2126,8 +2126,9 @@ def _attrs_to_init_script(
     )
     lines.extend(extra_lines)
 
-    args = []
-    kw_only_args = []
+    args = []  # Parameters in the definition of __init__
+    pre_init_args = []  # Parameters in the call to __attrs_pre_init__
+    kw_only_args = []  # Used for both 'args' and 'pre_init_args' above
     attrs_to_validate = []
 
     # This is a dictionary of names to validator and converter callables.
@@ -2205,6 +2206,7 @@ def _attrs_to_init_script(
                 kw_only_args.append(arg)
             else:
                 args.append(arg)
+                pre_init_args.append(arg_name)
 
             if converter is not None:
                 lines.append(
@@ -2224,6 +2226,7 @@ def _attrs_to_init_script(
                 kw_only_args.append(arg)
             else:
                 args.append(arg)
+                pre_init_args.append(arg_name)
             lines.append(f"if {arg_name} is not NOTHING:")
 
             init_factory_name = _INIT_FACTORY_PAT % (a.name,)
@@ -2266,6 +2269,7 @@ def _attrs_to_init_script(
                 kw_only_args.append(arg_name)
             else:
                 args.append(arg_name)
+                pre_init_args.append(arg_name)
 
             if converter is not None:
                 lines.append(
@@ -2322,7 +2326,7 @@ def _attrs_to_init_script(
         lines.append(f"BaseException.__init__(self, {vals})")
 
     args = ", ".join(args)
-    pre_init_args = args
+    pre_init_args = ", ".join(pre_init_args)
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
@@ -2337,7 +2341,7 @@ def _attrs_to_init_script(
         pre_init_args += pre_init_kw_only_args
 
     if call_pre_init and pre_init_has_args:
-        # If pre init method has arguments, pass same arguments as `__init__`.
+        # If pre init method has arguments, pass the values given to __init__.
         lines[0] = f"self.__attrs_pre_init__({pre_init_args})"
 
     # Python <3.12 doesn't allow backslashes in f-strings.
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +3/-1 | 21 | 1,635 | $0.088 |
| claude | muffle | pass | +3/-1 | 20 | 2,661 | $0.111 |
| claude | hush | pass | +3/-1 | 0 | 1,146 | $0.064 |
| claude | sloth | pass | +2/-1 | 16 | 1,809 | $0.077 |
| claude | all | pass | +1/-1 | 0 | 1,270 | $0.085 |
| codex | base | pass | +3/-1 | 34 | 1,387 | - |
| codex | muffle | pass | +1/-1 | 34 | 1,499 | - |
| codex | hush | pass | +1/-1 | 31 | 955 | - |
| codex | sloth | pass | +1/-1 | 38 | 1,306 | - |
| codex | all | pass | +1/-1 | 38 | 1,291 | - |

### claude, base: pass

Files: [changelog.d/pre-init-defaults.change.md](../base/claude/python-attrs-pre-init-defaults-1/files/changelog.d/pre-init-defaults.change.md), [src/attr/_make.py](../base/claude/python-attrs-pre-init-defaults-1/files/src/attr/_make.py), [tests/test_make.py](../base/claude/python-attrs-pre-init-defaults-1/files/tests/test_make.py)

<details><summary>diff</summary>

```diff
diff --git a/changelog.d/pre-init-defaults.change.md b/changelog.d/pre-init-defaults.change.md
new file mode 100644
index 0000000..8f6d9c4
--- /dev/null
+++ b/changelog.d/pre-init-defaults.change.md
@@ -0,0 +1 @@
+`__attrs_pre_init__` now receives the values passed to `__init__` for positional attributes that have defaults, instead of their defaults.
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..91ecd64 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2321,8 +2321,9 @@ def _attrs_to_init_script(
 
         lines.append(f"BaseException.__init__(self, {vals})")
 
+    # Pass the received values on, not the defaults.
+    pre_init_args = ", ".join(a.split("=")[0] for a in args)
     args = ", ".join(args)
-    pre_init_args = args
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
diff --git a/tests/test_make.py b/tests/test_make.py
index 80c0066..699858b 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -2749,3 +2749,24 @@ class TestMatchArgs:
 
         C1 = make_class("C1", {"a": attr.ib(kw_only=True), "b": attr.ib()})
         assert ("b",) == C1.__match_args__
+
+
+def test_pre_init_receives_passed_values_for_defaulted_args():
+    """
+    Values given for attributes with defaults reach __attrs_pre_init__.
+    """
+    seen = []
+
+    @attr.s
+    class C:
+        a = attr.ib()
+        b = attr.ib(default=100)
+        c = attr.ib(factory=dict)
+        d = attr.ib(default=100, kw_only=True)
+
+        def __attrs_pre_init__(self, a, b, c, d):
+            seen.append((a, b, c, d))
+
+    C(1, 2, {"x": 1}, d=3)
+
+    assert [(1, 2, {"x": 1}, 3)] == seen
```

</details>

<details><summary>reply</summary>

`__attrs_pre_init__` now gets the values you passed for `val2` and `val3`, not their defaults. I haven't re-run your exact `Example` snippet; a new regression test covers the same cases.

The generated `__init__` built the pre-init call from the positional argument list, which still included the defaults (such as `val2=<default>`). Keyword-only arguments already had their defaults stripped, which is why `val4` and `val5` worked. I applied the same stripping to positional ones in `src/attr/_make.py`.

I added a regression test in `tests/test_make.py` (`test_pre_init_receives_passed_values_for_defaulted_args`). It covers a plain default, a factory default and a keyword-only default. I also added a changelog entry, `changelog.d/pre-init-defaults.change.md`.

The test suite passes (1335 passed) with `tests/test_packaging.py` deselected. One test in that file, `test_version[attr]`, failed in the first run. I didn't look into why, and I left that file out of the final run. `attr` wasn't importable at first, so I ran pytest with `PYTHONPATH=src`.

I haven't committed anything.

</details>

### claude, muffle: pass

Files: [changelog.d/pre-init-defaults.change.md](../muffle/claude/python-attrs-pre-init-defaults-1/files/changelog.d/pre-init-defaults.change.md), [src/attr/_make.py](../muffle/claude/python-attrs-pre-init-defaults-1/files/src/attr/_make.py), [tests/test_make.py](../muffle/claude/python-attrs-pre-init-defaults-1/files/tests/test_make.py)

<details><summary>diff</summary>

```diff
diff --git a/changelog.d/pre-init-defaults.change.md b/changelog.d/pre-init-defaults.change.md
new file mode 100644
index 0000000..432a29d
--- /dev/null
+++ b/changelog.d/pre-init-defaults.change.md
@@ -0,0 +1 @@
+Passed values for non-keyword-only fields with defaults are now forwarded to `__attrs_pre_init__` instead of the defaults.
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..9900a2a 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2321,8 +2321,9 @@ def _attrs_to_init_script(
 
         lines.append(f"BaseException.__init__(self, {vals})")
 
+    # Defaults must not leak into the arguments passed to pre-init.
+    pre_init_args = ", ".join(arg.split("=")[0] for arg in args)
     args = ", ".join(args)
-    pre_init_args = args
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
diff --git a/tests/test_make.py b/tests/test_make.py
index 80c0066..137e65d 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -659,6 +659,26 @@ class TestAttributes:
 
         assert 11 == getattr(c, "z", None)
 
+    def test_pre_init_passes_given_values_over_defaults(self):
+        """
+        Values passed to __init__ reach __attrs_pre_init__ even if the
+        attributes have defaults.
+        """
+        seen = []
+
+        @attr.s
+        class C:
+            x = attr.ib()
+            y = attr.ib(default=1)
+            z = attr.ib(factory=dict)
+
+            def __attrs_pre_init__(self2, x, y, z):
+                seen.append((x, y, z))
+
+        C(10, 20, {"a": 1})
+
+        assert [(10, 20, {"a": 1})] == seen
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_pre_init_kwargs(self):
         """
```

</details>

<details><summary>reply</summary>

The positional args keep their `=default` text. Strip it, as is already done for kw-only args.

Fixed: `__attrs_pre_init__` now receives the values you passed to `__init__` for positional fields that have defaults. The full test suite passes except one test, `test_packaging.py::test_version[attr]`. That test fails because attrs isn't installed as a package here, so it looks unrelated to my change.

**Cause:** in `_attrs_to_init_script` (`src/attr/_make.py`), the argument list for the `__attrs_pre_init__` call was built from the `__init__` signature, which includes the `=default` text. Python therefore evaluated the default in that call instead of using the argument you passed. Keyword-only arguments already had their defaults stripped, which is why `val4` and `val5` worked. I now strip them for positional arguments too.

I ran your example with `src` on the path. The first call now prints `200 200 {'b': 1} 200 200`.

When you don't pass a value, `__attrs_pre_init__` still gets the default, as before. For a `factory=` field that default is the `NOTHING` sentinel, because the factory only runs later in `__init__`. `Example(1, val4=4)` prints `1 100 _Nothing.NOTHING 4 100`.

I added a regression test, `test_pre_init_passes_given_values_over_defaults`, in `tests/test_make.py`. I also added a changelog entry, `changelog.d/pre-init-defaults.change.md`. I didn't commit anything.

</details>

### claude, hush: pass

Files: [changelog.d/pre-init-defaults.change.md](../hush/claude/python-attrs-pre-init-defaults-1/files/changelog.d/pre-init-defaults.change.md), [src/attr/_make.py](../hush/claude/python-attrs-pre-init-defaults-1/files/src/attr/_make.py)

<details><summary>diff</summary>

```diff
diff --git a/changelog.d/pre-init-defaults.change.md b/changelog.d/pre-init-defaults.change.md
new file mode 100644
index 0000000..2b83f80
--- /dev/null
+++ b/changelog.d/pre-init-defaults.change.md
@@ -0,0 +1 @@
+`__attrs_pre_init__` now receives the values passed to `__init__` for positional attributes that have defaults, instead of the defaults.
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..36752bf 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2322,7 +2322,8 @@ def _attrs_to_init_script(
         lines.append(f"BaseException.__init__(self, {vals})")
 
     args = ", ".join(args)
-    pre_init_args = args
+    # Positional args without their defaults, so pre-init sees given values.
+    pre_init_args = ", ".join(a.split("=")[0] for a in args.split(", ") if a)
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
```

</details>

<details><summary>reply</summary>

Done. `__attrs_pre_init__` now gets the values passed to `__init__` for positional attributes with defaults. The fix is in `src/attr/_make.py`, and I added a changelog entry in `changelog.d/pre-init-defaults.change.md`.

I checked it with a trimmed version of your example (without `val4`/`val5`) and ran the `-k init` tests, which pass. I did not run the full test suite or add a regression test.

When you leave `val3` out, `__attrs_pre_init__` still receives `NOTHING` for it, since its factory only runs later inside `__init__`.

</details>

### claude, sloth: pass

Files: [changelog.d/pre-init-defaults.change.md](../sloth/claude/python-attrs-pre-init-defaults-1/files/changelog.d/pre-init-defaults.change.md), [src/attr/_make.py](../sloth/claude/python-attrs-pre-init-defaults-1/files/src/attr/_make.py), [tests/test_make.py](../sloth/claude/python-attrs-pre-init-defaults-1/files/tests/test_make.py)

<details><summary>diff</summary>

```diff
diff --git a/changelog.d/pre-init-defaults.change.md b/changelog.d/pre-init-defaults.change.md
new file mode 100644
index 0000000..bfdf945
--- /dev/null
+++ b/changelog.d/pre-init-defaults.change.md
@@ -0,0 +1 @@
+`__attrs_pre_init__` now receives the values passed to `__init__` for arguments that have defaults, instead of the defaults.
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..7f62940 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2321,8 +2321,8 @@ def _attrs_to_init_script(
 
         lines.append(f"BaseException.__init__(self, {vals})")
 
+    pre_init_args = ", ".join(a.split("=")[0] for a in args)
     args = ", ".join(args)
-    pre_init_args = args
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
diff --git a/tests/test_make.py b/tests/test_make.py
index 80c0066..6339f10 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -660,6 +660,22 @@ class TestAttributes:
         assert 11 == getattr(c, "z", None)
 
     @pytest.mark.usefixtures("with_and_without_validation")
+    def test_pre_init_args_with_defaults(self):
+        """
+        Verify that __attrs_pre_init__ gets the passed values, not the
+        defaults, for arguments that have defaults.
+        """
+
+        @attr.s
+        class C:
+            x = attr.ib(default=1)
+            y = attr.ib(factory=dict)
+
+            def __attrs_pre_init__(self2, x, y):
+                self2.seen = (x, y)
+
+        assert (2, {"a": 1}) == C(2, {"a": 1}).seen
+
     def test_pre_init_kwargs(self):
         """
         Verify that __attrs_pre_init__ gets called with extra args and kwargs
```

</details>

<details><summary>reply</summary>

Fixed: `__attrs_pre_init__` now gets the values you passed to `__init__` for arguments with defaults. The full test suite passes (1341 passed, 5 skipped, 3 xfailed). I didn't run your exact example separately, but the new test covers the same two cases (a plain default and a `factory=`).

The bug was in `src/attr/_make.py`. The generated `__init__` built the `__attrs_pre_init__` call from its own parameter list, default expressions included. That meant a call like `__attrs_pre_init__(val2=<default>)` passed the default instead of your value. It now strips the defaults, as the keyword-only arguments already did.

I added a regression test, `test_pre_init_args_with_defaults`, in `tests/test_make.py`. I also added a changelog entry at `changelog.d/pre-init-defaults.change.md`.

Nothing is committed.

</details>

### claude, all: pass

Files: [src/attr/_make.py](../all/claude/python-attrs-pre-init-defaults-1/files/src/attr/_make.py)

<details><summary>diff</summary>

```diff
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..103e80d 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2322,7 +2322,7 @@ def _attrs_to_init_script(
         lines.append(f"BaseException.__init__(self, {vals})")
 
     args = ", ".join(args)
-    pre_init_args = args
+    pre_init_args = ", ".join(arg.split("=")[0] for arg in args.split(", "))
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
```

</details>

<details><summary>reply</summary>

Done. In `src/attr/_make.py`, `pre_init_args` no longer includes default expressions, so `__attrs_pre_init__` gets the passed values; checked with a quick script, and 58 related tests pass. If you omit a factory field, `__attrs_pre_init__` still gets `NOTHING`. No regression test added.

</details>

### codex, base: pass

Files: [src/attr/_make.py](../base/codex/python-attrs-pre-init-defaults-1/files/src/attr/_make.py), [tests/test_make.py](../base/codex/python-attrs-pre-init-defaults-1/files/tests/test_make.py)

<details><summary>diff</summary>

```diff
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..96c3e84 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2321,8 +2321,10 @@ def _attrs_to_init_script(
 
         lines.append(f"BaseException.__init__(self, {vals})")
 
+    # Defaults belong in the signature, but the pre-init call must forward
+    # the values of the arguments.
+    pre_init_args = ", ".join(arg.split("=")[0] for arg in args)
     args = ", ".join(args)
-    pre_init_args = args
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
diff --git a/tests/test_make.py b/tests/test_make.py
index 80c0066..a4a82b7 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -696,6 +696,40 @@ class TestAttributes:
 
         assert 12 == getattr(c, "z", None)
 
+    @pytest.mark.parametrize("as_keywords", [False, True])
+    @pytest.mark.parametrize("use_defaults", [False, True])
+    def test_pre_init_defaults(self, as_keywords, use_defaults):
+        """
+        Pre-init receives argument values for defaults and factories.
+        """
+        received = []
+
+        @attr.define
+        class C:
+            required: int
+            _value: int = attr.field(default=100, alias="value")
+            data: dict = attr.field(factory=dict)
+            keyword: int = attr.field(default=100, kw_only=True)
+            ignored: int = attr.field(default=42, init=False)
+
+            def __attrs_pre_init__(self, required, value, data, *, keyword):
+                received.append((required, value, data, keyword))
+
+        if use_defaults:
+            c = C(required=200) if as_keywords else C(200)
+            assert received == [(200, 100, attr.NOTHING, 100)]
+            assert c.data == {}
+        else:
+            data = {"blah": "blah"}
+            c = (
+                C(required=200, value=200, data=data, keyword=200)
+                if as_keywords
+                else C(200, 200, data, keyword=200)
+            )
+            assert received == [(200, 200, data, 200)]
+            assert received[0][2] is data
+            assert c.data is data
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_pre_init_kw_only_work_with_defaults(self):
         """
```

</details>

<details><summary>reply</summary>

I’ll check how attrs generates the pre-init call, fix the argument forwarding, and add a regression test for defaults and factories.

The generated pre-init call was reusing signature entries such as `value=100`, which passed the default instead of the caller’s value. It now forwards argument names. All 265 tests in `test_make.py` pass, including the new cases for positional and keyword arguments, defaults, factories, and aliases.

Fixed pre-init argument forwarding so explicit values for defaulted attributes and factory fields reach `__attrs_pre_init__`.

Added regression coverage for positional and keyword calls, omitted defaults, factories, and aliases.

Validation: 1,340 tests passed. Four packaging tests failed because this environment lacks installed `attrs` package metadata.

</details>

### codex, muffle: pass

Files: [src/attr/_make.py](../muffle/codex/python-attrs-pre-init-defaults-1/files/src/attr/_make.py), [tests/test_make.py](../muffle/codex/python-attrs-pre-init-defaults-1/files/tests/test_make.py)

<details><summary>diff</summary>

```diff
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..1bbb0bb 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2321,8 +2321,8 @@ def _attrs_to_init_script(
 
         lines.append(f"BaseException.__init__(self, {vals})")
 
+    pre_init_args = ", ".join(arg.split("=")[0] for arg in args)
     args = ", ".join(args)
-    pre_init_args = args
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
diff --git a/tests/test_make.py b/tests/test_make.py
index 80c0066..5c4d20e 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -696,6 +696,40 @@ class TestAttributes:
 
         assert 12 == getattr(c, "z", None)
 
+    @pytest.mark.parametrize("passing", ["positional", "keyword", "omitted"])
+    @pytest.mark.parametrize("kw_only", [False, True])
+    def test_pre_init_defaults(self, passing, kw_only):
+        """
+        Pre-init receives the bound argument values, including defaults.
+        """
+        received = None
+
+        @attr.define
+        class C:
+            required = attr.field()
+            default = attr.field(default=100)
+            factory = attr.field(factory=dict)
+            keyword = attr.field(default=100, kw_only=kw_only)
+
+            def __attrs_pre_init__(self, required, default, factory, keyword):
+                nonlocal received
+                received = (required, default, factory, keyword)
+
+        value = {"blah": "blah"}
+        if passing == "positional":
+            c = C(200, 200, value, keyword=200)
+        elif passing == "keyword":
+            c = C(required=200, default=200, factory=value, keyword=200)
+        else:
+            c = C(200)
+
+        if passing == "omitted":
+            assert (200, 100, attr.NOTHING, 100) == received
+            assert {} == c.factory
+        else:
+            assert (200, 200, value, 200) == received
+            assert value is received[2] is c.factory
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_pre_init_kw_only_work_with_defaults(self):
         """
```

</details>

<details><summary>reply</summary>

I’ll check how the generated initializer forwards arguments, fix the defaults case, and add a regression test.

The generated hook call reused parameter declarations such as `val2=100`, which passed the default instead of the supplied value. I’ve changed it to forward the parameter values and added coverage for positional, keyword, and omitted arguments, including factory defaults.

Fixed argument forwarding so `__attrs_pre_init__` receives supplied values for fields with defaults and factories.

Added regression coverage for positional, keyword, and omitted arguments. All 267 tests in `test_make.py` pass. The full suite had 1,342 passes and four packaging failures caused by missing installed `attrs` metadata.

</details>

### codex, hush: pass

Files: [src/attr/_make.py](../hush/codex/python-attrs-pre-init-defaults-1/files/src/attr/_make.py), [tests/test_make.py](../hush/codex/python-attrs-pre-init-defaults-1/files/tests/test_make.py)

<details><summary>diff</summary>

```diff
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..1bbb0bb 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2321,8 +2321,8 @@ def _attrs_to_init_script(
 
         lines.append(f"BaseException.__init__(self, {vals})")
 
+    pre_init_args = ", ".join(arg.split("=")[0] for arg in args)
     args = ", ".join(args)
-    pre_init_args = args
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
diff --git a/tests/test_make.py b/tests/test_make.py
index 80c0066..b8a6011 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -696,6 +696,37 @@ class TestAttributes:
 
         assert 12 == getattr(c, "z", None)
 
+    @pytest.mark.parametrize("passing", ["positional", "keyword", "omitted"])
+    def test_pre_init_defaults(self, passing):
+        """
+        Pre-init receives supplied values for fields with defaults or factories.
+        """
+        received = []
+
+        @attr.define
+        class C:
+            required = attr.field()
+            value = attr.field(default=100)
+            mapping = attr.field(factory=dict)
+            keyword = attr.field(kw_only=True, default=100)
+
+            def __attrs_pre_init__(self, required, value, mapping, *, keyword):
+                received.append((required, value, mapping, keyword))
+
+        mapping = {"blah": "blah"}
+        if passing == "positional":
+            C(200, 200, mapping, keyword=200)
+        elif passing == "keyword":
+            C(required=200, value=200, mapping=mapping, keyword=200)
+        else:
+            C(200)
+
+        if passing == "omitted":
+            assert received == [(200, 100, attr.NOTHING, 100)]
+        else:
+            assert received == [(200, 200, mapping, 200)]
+            assert received[0][2] is mapping
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_pre_init_kw_only_work_with_defaults(self):
         """
```

</details>

<details><summary>reply</summary>

Done.
`__attrs_pre_init__` now receives supplied values for defaulted positional fields. Regression tests added; 264 passed, 1 skipped, 1 expected failure.

</details>

### codex, sloth: pass

Files: [src/attr/_make.py](../sloth/codex/python-attrs-pre-init-defaults-1/files/src/attr/_make.py), [tests/test_make.py](../sloth/codex/python-attrs-pre-init-defaults-1/files/tests/test_make.py)

<details><summary>diff</summary>

```diff
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..1bbb0bb 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2321,8 +2321,8 @@ def _attrs_to_init_script(
 
         lines.append(f"BaseException.__init__(self, {vals})")
 
+    pre_init_args = ", ".join(arg.split("=")[0] for arg in args)
     args = ", ".join(args)
-    pre_init_args = args
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
diff --git a/tests/test_make.py b/tests/test_make.py
index 80c0066..3a50a61 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -715,6 +715,44 @@ class TestAttributes:
 
         assert 3 == val == inst.kw_and_default
 
+    @pytest.mark.parametrize("arguments", ["positional", "keyword", "omitted"])
+    def test_pre_init_defaults(self, arguments):
+        """
+        Pre-init receives supplied values or defaults before factories run.
+        """
+        received = None
+
+        @attr.define
+        class Example:
+            val1: int
+            val2: int = 100
+            val3: dict = attr.field(factory=dict)
+            val4: int = attr.field(kw_only=True)
+            val5: int = attr.field(default=100, kw_only=True)
+
+            def __attrs_pre_init__(self, val1, val2, val3, val4, val5):
+                """Record the initializer arguments."""
+                nonlocal received
+                received = (val1, val2, val3, val4, val5)
+
+        value = {"blah": "blah"}
+        if arguments == "positional":
+            inst = Example(200, 200, value, val4=200, val5=200)
+        elif arguments == "keyword":
+            inst = Example(
+                val1=200, val2=200, val3=value, val4=200, val5=200
+            )
+        else:
+            inst = Example(200, val4=200)
+
+        if arguments == "omitted":
+            assert (200, 100, attr.NOTHING, 200, 100) == received
+            assert {} == inst.val3
+        else:
+            assert (200, 200, value, 200, 200) == received
+            assert received[2] is value
+            assert inst.val3 is value
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_post_init(self):
         """
```

</details>

<details><summary>reply</summary>

I’ll check how the generated initializer forwards arguments to `__attrs_pre_init__`, fix the shared code, and add regression coverage.

The generator was reusing parameter declarations as call arguments, so default expressions replaced supplied values. I’ve changed it to forward parameter names and added tests for your example, positional arguments, and omitted defaults, including the factory sentinel behavior.

Fixed argument forwarding so `__attrs_pre_init__` receives supplied values for fields with defaults and factories.

Regression tests cover your example, positional arguments, and omitted defaults. Package build succeeded; tests: 363 passed, 1 skipped, 1 expected failure.

No new options added. Full test suite was not run.

</details>

### codex, all: pass

Files: [src/attr/_make.py](../all/codex/python-attrs-pre-init-defaults-1/files/src/attr/_make.py), [tests/test_make.py](../all/codex/python-attrs-pre-init-defaults-1/files/tests/test_make.py)

<details><summary>diff</summary>

```diff
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..1bbb0bb 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2321,8 +2321,8 @@ def _attrs_to_init_script(
 
         lines.append(f"BaseException.__init__(self, {vals})")
 
+    pre_init_args = ", ".join(arg.split("=")[0] for arg in args)
     args = ", ".join(args)
-    pre_init_args = args
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
diff --git a/tests/test_make.py b/tests/test_make.py
index 80c0066..654be7e 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -715,6 +715,44 @@ class TestAttributes:
 
         assert 3 == val == inst.kw_and_default
 
+    @pytest.mark.parametrize("arguments", ["positional", "keyword", "defaults"])
+    def test_pre_init_defaults(self, arguments):
+        """
+        Pre-init receives supplied values or defaults for all parameter kinds.
+        """
+        received = None
+
+        @attr.define
+        class Example:
+            val1: int
+            val2: int = 100
+            val3: dict = attr.field(factory=dict)
+            val4: int = attr.field(kw_only=True)
+            val5: int = attr.field(default=100, kw_only=True)
+
+            def __attrs_pre_init__(self, val1, val2, val3, val4, val5):
+                """Record arguments before initialization."""
+                nonlocal received
+                received = (val1, val2, val3, val4, val5)
+
+        supplied = {"blah": "blah"}
+        if arguments == "positional":
+            instance = Example(200, 200, supplied, val4=200, val5=200)
+        elif arguments == "keyword":
+            instance = Example(
+                val1=200, val2=200, val3=supplied, val4=200, val5=200
+            )
+        else:
+            instance = Example(200, val4=200)
+
+        if arguments == "defaults":
+            assert (200, 100, attr.NOTHING, 200, 100) == received
+            assert instance.val3 == {}
+        else:
+            assert (200, 200, supplied, 200, 200) == received
+            assert received[2] is supplied
+            assert instance.val3 is supplied
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_post_init(self):
         """
```

</details>

<details><summary>reply</summary>

Done.
Fixed `__attrs_pre_init__` forwarding for supplied defaulted arguments; added regression tests. Wheel built; 363 tests passed, 1 skipped, 1 xfailed. Full suite not run.

</details>
