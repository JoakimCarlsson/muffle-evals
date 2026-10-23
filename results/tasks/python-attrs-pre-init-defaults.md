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
| claude | base | pass | +3/-1 | 17 | 2,719 | $0.108 |
| claude | muffle | pass | +6/-1 | 0 | 1,350 | $0.052 |
| claude | hush | pass | +3/-1 | 0 | 1,294 | $0.055 |
| claude | sloth | pass | +2/-1 | 22 | 2,124 | $0.091 |
| claude | all | pass | +2/-1 | 19 | 1,823 | $0.088 |
| codex | base | pass | +2/-1 | 38 | 1,491 | - |
| codex | muffle | pass | +2/-1 | 44 | 1,439 | - |
| codex | hush | pass | +1/-1 | 41 | 1,165 | - |
| codex | sloth | pass | +1/-1 | 36 | 1,562 | - |
| codex | all | pass | +1/-1 | 41 | 1,512 | - |

### claude, base: pass

Files: [changelog.d/pre-init-defaults.change.md](../base/claude/python-attrs-pre-init-defaults-1/files/changelog.d/pre-init-defaults.change.md), [src/attr/_make.py](../base/claude/python-attrs-pre-init-defaults-1/files/src/attr/_make.py), [tests/test_make.py](../base/claude/python-attrs-pre-init-defaults-1/files/tests/test_make.py)

<details><summary>diff</summary>

```diff
diff --git a/changelog.d/pre-init-defaults.change.md b/changelog.d/pre-init-defaults.change.md
new file mode 100644
index 0000000..c0144ab
--- /dev/null
+++ b/changelog.d/pre-init-defaults.change.md
@@ -0,0 +1 @@
+Fixed `__attrs_pre_init__` receiving default values instead of the passed values for positional attributes with defaults.
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..ef5024b 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2321,8 +2321,9 @@ def _attrs_to_init_script(
 
         lines.append(f"BaseException.__init__(self, {vals})")
 
+    # We need to remove the defaults from the positional args.
+    pre_init_args = ", ".join(a.split("=")[0] for a in args)
     args = ", ".join(args)
-    pre_init_args = args
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
diff --git a/tests/test_make.py b/tests/test_make.py
index 80c0066..b4ff884 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -659,6 +659,23 @@ class TestAttributes:
 
         assert 11 == getattr(c, "z", None)
 
+    @pytest.mark.usefixtures("with_and_without_validation")
+    def test_pre_init_args_with_defaults(self):
+        """
+        __attrs_pre_init__ gets the passed values, not the defaults.
+        """
+
+        @attr.s
+        class C:
+            x = attr.ib()
+            y = attr.ib(default=100)
+            z = attr.ib(factory=dict)
+
+            def __attrs_pre_init__(self2, x, y, z):
+                self2.seen = (x, y, z)
+
+        assert (1, 2, {"a": 1}) == C(1, 2, {"a": 1}).seen
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_pre_init_kwargs(self):
         """
```

</details>

<details><summary>reply</summary>

`__attrs_pre_init__` now receives the values you passed for positional attributes that have defaults. Your example now prints 200 for `val2` and `{"blah": "blah"}` for `val3`. I ran the init, slots and make tests (661 passed) and a new regression test for this. I didn't run the full test suite.

The generated `__init__` forwarded its own parameter list to `__attrs_pre_init__`, defaults included. Because of that, the call was `__attrs_pre_init__(val1, val2=<default>, ...)`, so the default was always used. The kw-only arguments already had their defaults stripped, which is why `val4` and `val5` worked. I applied the same stripping to the positional arguments in `src/attr/_make.py`.

If you omit an attribute that has a `factory`, `__attrs_pre_init__` still gets `NOTHING` for it. The factory only runs later, after pre-init. I left that as it is.

I added `test_pre_init_args_with_defaults` in `tests/test_make.py` and a changelog entry at `changelog.d/pre-init-defaults.change.md`. I didn't commit anything.

</details>

### claude, muffle: pass

Files: [changelog.d/pre-init-defaults.change.md](../muffle/claude/python-attrs-pre-init-defaults-1/files/changelog.d/pre-init-defaults.change.md), [src/attr/_make.py](../muffle/claude/python-attrs-pre-init-defaults-1/files/src/attr/_make.py)

<details><summary>diff</summary>

```diff
diff --git a/changelog.d/pre-init-defaults.change.md b/changelog.d/pre-init-defaults.change.md
new file mode 100644
index 0000000..a71987d
--- /dev/null
+++ b/changelog.d/pre-init-defaults.change.md
@@ -0,0 +1 @@
+Fixed `__attrs_pre_init__` receiving the default values instead of the passed values for positional attributes that have defaults.
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..9f79315 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2321,8 +2321,12 @@ def _attrs_to_init_script(
 
         lines.append(f"BaseException.__init__(self, {vals})")
 
+    pre_init_args = ", ".join(
+        # We need to remove the defaults from the positional args.
+        arg.split("=")[0]
+        for arg in args
+    )
     args = ", ".join(args)
-    pre_init_args = args
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
```

</details>

<details><summary>reply</summary>

`__attrs_pre_init__` now receives the values you passed for `val2` and `val3`. The test suite passes.

The generated `__init__` was calling `__attrs_pre_init__` with the positional parameters' default expressions (`val2=100`, `val3=NOTHING`) still attached. It only stripped the defaults from keyword-only ones, which is why `val4` and `val5` worked. The fix is in `src/attr/_make.py` and strips the defaults from the positional arguments too. I also added a changelog entry, `changelog.d/pre-init-defaults.change.md`. It has no issue number in the filename, so rename it if your towncrier setup needs one.

I checked it with a smaller version of your example, with `a`, `b`, `c` and a keyword-only `d`. Passing `E(1, 2, {"x": 1}, d=4)` gives `1 2 {'x': 1} 4`. I didn't add a regression test.

If you omit an argument that has a default, `__attrs_pre_init__` still doesn't see the default. A plain default arrives as `100`, but a `factory=` field arrives as `NOTHING`, because the factory only runs later. That matches how keyword-only fields already behaved.

</details>

### claude, hush: pass

Files: [changelog.d/+pre-init-defaults.change.md](../hush/claude/python-attrs-pre-init-defaults-1/files/changelog.d/+pre-init-defaults.change.md), [src/attr/_make.py](../hush/claude/python-attrs-pre-init-defaults-1/files/src/attr/_make.py)

<details><summary>diff</summary>

```diff
diff --git a/changelog.d/+pre-init-defaults.change.md b/changelog.d/+pre-init-defaults.change.md
new file mode 100644
index 0000000..89789c2
--- /dev/null
+++ b/changelog.d/+pre-init-defaults.change.md
@@ -0,0 +1 @@
+Fixed `__attrs_pre_init__` receiving default values instead of passed values for non-keyword-only attributes with defaults.
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..fbda9bd 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2321,8 +2321,9 @@ def _attrs_to_init_script(
 
         lines.append(f"BaseException.__init__(self, {vals})")
 
+    # We need to remove the defaults from the positional args.
+    pre_init_args = ", ".join(arg.split("=")[0] for arg in args)
     args = ", ".join(args)
-    pre_init_args = args
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
```

</details>

<details><summary>reply</summary>

Done. Fixed in `src/attr/_make.py`: positional args now go to `__attrs_pre_init__` without their defaults, so passed values arrive. Changelog added at `changelog.d/+pre-init-defaults.change.md`. I ran only the `pre_init` and `init` tests, which pass. I added no regression test.

Omitted factory fields still reach `__attrs_pre_init__` as `NOTHING`.

</details>

### claude, sloth: pass

Files: [changelog.d/+pre-init-defaults.change.md](../sloth/claude/python-attrs-pre-init-defaults-1/files/changelog.d/+pre-init-defaults.change.md), [src/attr/_make.py](../sloth/claude/python-attrs-pre-init-defaults-1/files/src/attr/_make.py), [tests/test_make.py](../sloth/claude/python-attrs-pre-init-defaults-1/files/tests/test_make.py)

<details><summary>diff</summary>

```diff
diff --git a/changelog.d/+pre-init-defaults.change.md b/changelog.d/+pre-init-defaults.change.md
new file mode 100644
index 0000000..2f8395e
--- /dev/null
+++ b/changelog.d/+pre-init-defaults.change.md
@@ -0,0 +1 @@
+Fixed `__attrs_pre_init__` receiving default values instead of the values passed to `__init__` for non-keyword-only fields with defaults or factories.
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
index 80c0066..c12080d 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -715,6 +715,28 @@ class TestAttributes:
 
         assert 3 == val == inst.kw_and_default
 
+    @pytest.mark.usefixtures("with_and_without_validation")
+    def test_pre_init_passes_given_values_not_defaults(self):
+        """
+        Positional fields with defaults or factories get the values passed to
+        __init__ in __attrs_pre_init__, not their defaults.
+        """
+        seen = None
+
+        @attr.define
+        class C:
+            a: int
+            b: int = 100
+            c: dict = attr.field(factory=dict)
+
+            def __attrs_pre_init__(self, a, b, c):
+                nonlocal seen
+                seen = (a, b, c)
+
+        C(1, 2, {"x": 1})
+
+        assert (1, 2, {"x": 1}) == seen
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_post_init(self):
         """
```

</details>

<details><summary>reply</summary>

`__attrs_pre_init__` now gets the values you passed to `__init__`. The new test and the existing `tests/test_make.py` tests pass (263 passed, 1 skipped, 1 xfailed). I didn't run your exact snippet or the rest of the test suite.

The generated `__init__` built the pre-init call from the positional parameter list with the defaults still attached. Each call therefore passed the field's default expression instead of the argument you gave. The fix is in `src/attr/_make.py`, where the pre-init call now uses only the parameter names. Keyword-only fields already did this, which is why `val4` and `val5` were correct.

I added a regression test in `tests/test_make.py` covering a plain default and a factory. I also added a changelog entry at `changelog.d/+pre-init-defaults.change.md`. I didn't commit anything.

If you omit a factory field, `__attrs_pre_init__` still receives `NOTHING` for it. That is existing behaviour and I left it alone, since the factory only runs after the pre-init call.

</details>

### claude, all: pass

Files: [changelog.d/+pre-init-defaults.change.md](../all/claude/python-attrs-pre-init-defaults-1/files/changelog.d/+pre-init-defaults.change.md), [src/attr/_make.py](../all/claude/python-attrs-pre-init-defaults-1/files/src/attr/_make.py), [tests/test_make.py](../all/claude/python-attrs-pre-init-defaults-1/files/tests/test_make.py)

<details><summary>diff</summary>

```diff
diff --git a/changelog.d/+pre-init-defaults.change.md b/changelog.d/+pre-init-defaults.change.md
new file mode 100644
index 0000000..c221241
--- /dev/null
+++ b/changelog.d/+pre-init-defaults.change.md
@@ -0,0 +1 @@
+Fixed `__attrs_pre_init__` receiving default values instead of the passed ones for attributes with defaults or factories.
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..7459547 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2322,7 +2322,7 @@ def _attrs_to_init_script(
         lines.append(f"BaseException.__init__(self, {vals})")
 
     args = ", ".join(args)
-    pre_init_args = args
+    pre_init_args = ", ".join(a.split("=")[0] for a in args.split(", ") if a)
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
diff --git a/tests/test_make.py b/tests/test_make.py
index 80c0066..5220f47 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -659,6 +659,25 @@ class TestAttributes:
 
         assert 11 == getattr(c, "z", None)
 
+    @pytest.mark.usefixtures("with_and_without_validation")
+    def test_pre_init_args_with_defaults(self):
+        """
+        Verify that __attrs_pre_init__ gets the passed values, not the
+        defaults, for attributes with defaults and factories.
+        """
+
+        @attr.s
+        class C:
+            x = attr.ib()
+            y = attr.ib(default=100)
+            z = attr.ib(factory=dict)
+
+            def __attrs_pre_init__(self2, x, y, z):
+                self2.seen = (x, y, z)
+
+        assert (1, 2, {"a": 1}) == C(1, 2, {"a": 1}).seen
+        assert (1, 100, attr.NOTHING) == C(1).seen
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_pre_init_kwargs(self):
         """
```

</details>

<details><summary>reply</summary>

Done. Positional defaults no longer leak into the `__attrs_pre_init__` call in `src/attr/_make.py`, so `val2` and `val3` now get the values you passed. I added a test and the changelog entry `changelog.d/+pre-init-defaults.change.md`. `tests/test_make.py` passes; I didn't run the rest of the suite.

When an argument isn't passed, a factory field (`val3`) still reaches `__attrs_pre_init__` as `NOTHING`, because the factory only runs after pre-init.

</details>

### codex, base: pass

Files: [src/attr/_make.py](../base/codex/python-attrs-pre-init-defaults-1/files/src/attr/_make.py), [tests/test_make.py](../base/codex/python-attrs-pre-init-defaults-1/files/tests/test_make.py)

<details><summary>diff</summary>

```diff
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..31213aa 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2321,8 +2321,9 @@ def _attrs_to_init_script(
 
         lines.append(f"BaseException.__init__(self, {vals})")
 
+    # Forward parameter values, without the defaults used in the signature.
+    pre_init_args = ", ".join(arg.split("=")[0] for arg in args)
     args = ", ".join(args)
-    pre_init_args = args
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
diff --git a/tests/test_make.py b/tests/test_make.py
index 80c0066..fd89123 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -696,6 +696,44 @@ class TestAttributes:
 
         assert 12 == getattr(c, "z", None)
 
+    @pytest.mark.parametrize("call_style", ["positional", "keyword", "defaults"])
+    def test_pre_init_defaults(self, call_style):
+        """
+        Pre-init receives argument values for defaults and factories.
+        """
+        received = []
+
+        @attr.define
+        class C:
+            required: int
+            _value: int = attr.field(default=100, alias="value")
+            factory: dict = attr.field(factory=dict)
+            kw_required: int = attr.field(kw_only=True)
+            kw_default: int = attr.field(default=100, kw_only=True)
+            kw_factory: dict = attr.field(factory=dict, kw_only=True)
+            ignored: int = attr.field(default=42, init=False)
+
+            def __attrs_pre_init__(self, *args, **kwargs):
+                received.append((args, kwargs))
+
+        value = {"blah": "blah"}
+        kwargs = {"kw_required": 200}
+        if call_style == "defaults":
+            inst = C(200, **kwargs)
+            expected = (200, 100, attr.NOTHING)
+            kwargs.update(kw_default=100, kw_factory=attr.NOTHING)
+            assert inst.factory == inst.kw_factory == {}
+        else:
+            kwargs.update(kw_default=200, kw_factory=value)
+            if call_style == "positional":
+                inst = C(200, 200, value, **kwargs)
+            else:
+                inst = C(required=200, value=200, factory=value, **kwargs)
+            expected = (200, 200, value)
+            assert inst.factory is inst.kw_factory is value
+
+        assert received == [(expected, kwargs)]
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_pre_init_kw_only_work_with_defaults(self):
         """
```

</details>

<details><summary>reply</summary>

I’ll check how attrs builds the pre-init call, fix the argument forwarding, and add a regression test for defaults and factories.

The pre-init call was reusing parameter declarations such as `val2=100`, which passed the default instead of the current value. It now forwards parameter names. The regression test covers positional and keyword calls, omitted defaults, factories, and aliases.

Fixed pre-init forwarding so defaulted positional parameters receive the values passed to `__init__`.

Added regression coverage for positional and keyword calls, factories, omitted defaults, and aliases.

Validation: 1,339 tests passed. Four packaging tests failed because the environment lacks installed attrs package metadata.

</details>

### codex, muffle: pass

Files: [src/attr/_make.py](../muffle/codex/python-attrs-pre-init-defaults-1/files/src/attr/_make.py), [tests/test_make.py](../muffle/codex/python-attrs-pre-init-defaults-1/files/tests/test_make.py)

<details><summary>diff</summary>

```diff
diff --git a/src/attr/_make.py b/src/attr/_make.py
index e84d979..b297d9a 100644
--- a/src/attr/_make.py
+++ b/src/attr/_make.py
@@ -2321,8 +2321,9 @@ def _attrs_to_init_script(
 
         lines.append(f"BaseException.__init__(self, {vals})")
 
+    # Forward parameter values, without the defaults from the signature.
+    pre_init_args = ", ".join(arg.split("=")[0] for arg in args)
     args = ", ".join(args)
-    pre_init_args = args
     if kw_only_args:
         # leading comma & kw_only args
         args += f"{', ' if args else ''}*, {', '.join(kw_only_args)}"
diff --git a/tests/test_make.py b/tests/test_make.py
index 80c0066..af7619f 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -696,6 +696,50 @@ class TestAttributes:
 
         assert 12 == getattr(c, "z", None)
 
+    @pytest.mark.parametrize("call_style", ["positional", "keyword", "defaults"])
+    def test_pre_init_defaults(self, call_style):
+        """
+        Pre-init receives argument values, including overrides of defaults.
+        Omitted factories are passed as NOTHING before initialization.
+        """
+        received = []
+
+        @attr.define
+        class C:
+            required: int
+            _value: int = attr.field(default=100, alias="value")
+            mapping: dict = attr.field(factory=dict)
+            ignored: int = attr.field(default=42, init=False)
+            kw_required: int = attr.field(kw_only=True)
+            kw_default: int = attr.field(default=100, kw_only=True)
+
+            def __attrs_pre_init__(
+                self, required, value, mapping, *, kw_required, kw_default
+            ):
+                received.append(
+                    (required, value, mapping, kw_required, kw_default)
+                )
+
+        mapping = {"blah": "blah"}
+        if call_style == "positional":
+            C(200, 200, mapping, kw_required=200, kw_default=200)
+        elif call_style == "keyword":
+            C(
+                required=200,
+                value=200,
+                mapping=mapping,
+                kw_required=200,
+                kw_default=200,
+            )
+        else:
+            inst = C(200, kw_required=200)
+            assert received == [(200, 100, attr.NOTHING, 200, 100)]
+            assert inst.mapping == {}
+            return
+
+        assert received == [(200, 200, mapping, 200, 200)]
+        assert received[0][2] is mapping
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_pre_init_kw_only_work_with_defaults(self):
         """
```

</details>

<details><summary>reply</summary>

I’ll check how attrs generates the pre-init call, fix the argument forwarding, and add a regression test for defaults and factories.

The generated pre-init call reused the parameter declarations, so `val2=100` passed the default explicitly. It now forwards parameter names only. The regression tests pass for positional arguments, keyword arguments, and omitted defaults; the full suite is running.

Fixed `__attrs_pre_init__` to receive supplied argument values instead of defaults.

Added regression coverage for positional and keyword arguments, omitted defaults, and factories.

Validation: 1,343 tests passed, 5 skipped, 3 expected failures. Ruff was unavailable.

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
index 80c0066..f94701e 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -696,6 +696,47 @@ class TestAttributes:
 
         assert 12 == getattr(c, "z", None)
 
+    @pytest.mark.parametrize("as_keywords", [False, True])
+    @pytest.mark.parametrize("use_defaults", [False, True])
+    def test_pre_init_defaults(self, as_keywords, use_defaults):
+        """
+        Pre-init receives argument values, including defaults when omitted.
+        """
+        received = []
+
+        @attr.define
+        class C:
+            required: int
+            _value: int = attr.field(default=100, alias="value")
+            mapping: dict = attr.field(factory=dict)
+            keyword: int = attr.field(kw_only=True)
+            optional: int = attr.field(default=100, kw_only=True)
+            ignored: int = attr.field(default=42, init=False)
+
+            def __attrs_pre_init__(
+                self, required, value, mapping, *, keyword, optional
+            ):
+                received.append((required, value, mapping, keyword, optional))
+
+        mapping = {"blah": "blah"}
+        if use_defaults:
+            inst = C(200, keyword=200)
+            assert received == [(200, 100, attr.NOTHING, 200, 100)]
+            assert inst.mapping == {}
+        else:
+            if as_keywords:
+                C(
+                    required=200,
+                    value=200,
+                    mapping=mapping,
+                    keyword=200,
+                    optional=200,
+                )
+            else:
+                C(200, 200, mapping, keyword=200, optional=200)
+            assert received == [(200, 200, mapping, 200, 200)]
+            assert received[0][2] is mapping
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_pre_init_kw_only_work_with_defaults(self):
         """
```

</details>

<details><summary>reply</summary>

Done.
`__attrs_pre_init__` receives supplied values for defaulted positional fields. Regression tests added. Suite: 1,344 passed, 5 skipped, 3 expected failures.

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
index 80c0066..9c10b73 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -696,6 +696,42 @@ class TestAttributes:
 
         assert 12 == getattr(c, "z", None)
 
+    @pytest.mark.parametrize("arguments", ["positional", "keyword", "omitted"])
+    def test_pre_init_defaults(self, arguments):
+        """
+        Pre-init receives supplied values or defaults for all init parameters.
+        """
+        received = None
+
+        @attr.define
+        class C:
+            val1: int
+            val2: int = 100
+            _val3: dict = attr.field(factory=dict, alias="val3")
+            val4: int = attr.field(kw_only=True)
+            val5: int = attr.field(default=100, kw_only=True)
+            ignored: int = attr.field(default=0, init=False)
+
+            def __attrs_pre_init__(self, val1, val2, val3, *, val4, val5):
+                """Record arguments before attributes are initialized."""
+                nonlocal received
+                received = (val1, val2, val3, val4, val5)
+
+        value = {"blah": "blah"}
+        if arguments == "positional":
+            inst = C(200, 200, value, val4=200, val5=200)
+        elif arguments == "keyword":
+            inst = C(val1=200, val2=200, val3=value, val4=200, val5=200)
+        else:
+            inst = C(200, val4=200)
+
+        if arguments == "omitted":
+            assert (200, 100, attr.NOTHING, 200, 100) == received
+            assert {} == inst._val3
+        else:
+            assert (200, 200, value, 200, 200) == received
+            assert value is received[2] is inst._val3
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_pre_init_kw_only_work_with_defaults(self):
         """
```

</details>

<details><summary>reply</summary>

I’ll check how attrs generates the pre-init call, fix the argument forwarding, and add a regression test.

The pre-init call reuses parameter declarations such as `val2=100`, so Python treats the defaults as keyword arguments. The fix is in the shared initializer generator, which serves both `__init__` and `__attrs_init__`; the existing test file is the only other place that needs changing. No signatures, exports, fixtures, or configuration need changes.

I’ll test positional and keyword values, omitted defaults, factory fields, aliases, and keyword-only fields, preserving the existing behavior for omitted factory arguments.

Fixed the shared initializer generator so `__attrs_pre_init__` receives supplied values instead of default expressions.

Added regression coverage for positional and keyword arguments, omitted defaults, factories, aliases, and keyword-only fields.

Validation: 1,343 tests passed, 5 skipped, 3 expected failures. Wheel build succeeded.

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
index 80c0066..828252f 100644
--- a/tests/test_make.py
+++ b/tests/test_make.py
@@ -696,6 +696,47 @@ class TestAttributes:
 
         assert 12 == getattr(c, "z", None)
 
+    @pytest.mark.parametrize("passing", ["defaults", "positional", "keyword"])
+    def test_pre_init_defaults(self, passing):
+        """
+        Pre-init receives argument values, including defaults and factories.
+        """
+        received = []
+
+        @attr.define
+        class C:
+            val1: int
+            _val2: int = attr.field(default=100, alias="value")
+            val3: dict = attr.field(factory=dict)
+            val4: int = attr.field(kw_only=True)
+            val5: int = attr.field(default=100, kw_only=True)
+            ignored: int = attr.field(default=1, init=False)
+
+            def __attrs_pre_init__(self, val1, value, val3, *, val4, val5):
+                """Record arguments before attribute initialization."""
+                received.append((val1, value, val3, val4, val5))
+
+        if passing == "defaults":
+            inst = C(200, val4=200)
+            expected = (200, 100, attr.NOTHING, 200, 100)
+            assert inst.val3 == {}
+        else:
+            value = {"blah": "blah"}
+            if passing == "positional":
+                inst = C(200, 200, value, val4=200, val5=200)
+            else:
+                inst = C(val1=200, value=200, val3=value, val4=200, val5=200)
+            expected = (200, 200, value, 200, 200)
+            assert inst.val3 is value
+
+        assert received == [expected]
+        assert (inst.val1, inst._val2, inst.val4, inst.val5) == (
+            expected[0],
+            expected[1],
+            expected[3],
+            expected[4],
+        )
+
     @pytest.mark.usefixtures("with_and_without_validation")
     def test_pre_init_kw_only_work_with_defaults(self):
         """
```

</details>

<details><summary>reply</summary>

Pre-init forwarding bug. Checking generated arguments and existing tests.


Done.
Fixed pre-init argument forwarding; regression tests added. Tests: 1,343 passed, 5 skipped, 3 xfailed. Build/lint unavailable: missing `build`/`ruff`.

</details>
