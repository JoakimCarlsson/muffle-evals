# python-click-choice-double-brackets

Source: https://github.com/pallets/click/pull/3578

## Prompt

> The usage line in `--help` shows double square brackets for an optional argument whose type is a `Choice` (or a `DateTime`):
> 
> ```python
> import click
> 
> @click.command()
> @click.argument("method", type=click.Choice(["foo", "bar", "baz"]), nargs=-1)
> def cli(method):
>     pass
> 
> cli()
> ```
> 
> ```
> $ python cli.py --help
> Usage: cli.py [OPTIONS] [[foo|bar|baz]]...
> ```
> 
> Same with `required=False` instead of `nargs=-1` (`[[foo|bar|baz]]`), and with `type=click.DateTime(formats=["%Y-%m-%d"])`, which gives `[[%Y-%m-%d]]`. The choices are already in brackets, so the extra pair is just noise; I expected `Usage: cli.py [OPTIONS] [foo|bar|baz]...`. Required arguments of these types look fine.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [CHANGES.md](../../tasks/python-click-choice-double-brackets/upstream/CHANGES.md), [src/click/core.py](../../tasks/python-click-choice-double-brackets/upstream/src/click/core.py), [tests/test_basic.py](../../tasks/python-click-choice-double-brackets/upstream/tests/test_basic.py)

```diff
diff --git a/CHANGES.md b/CHANGES.md
index 8991e82..90b93ed 100644
--- a/CHANGES.md
+++ b/CHANGES.md
@@ -18,6 +18,8 @@ Unreleased
   stream when no external pager runs, completing the partial
   `I/O operation on closed file` fix from {pr}`3482`. {issue}`3449`
   {pr}`3533`
+- Fix CLI usage symopsis for optional arguments producing double square brackets
+  `[[a|b|c]]...` whose type already brackets their metavar. {pr}`3578`
 
 ## Version 8.4.1
 
diff --git a/src/click/core.py b/src/click/core.py
index d2db291..d7ecbef 100644
--- a/src/click/core.py
+++ b/src/click/core.py
@@ -3571,9 +3571,14 @@ class Argument(Parameter):
         var = self.type.get_metavar(param=self, ctx=ctx)
         if not var:
             var = self.name.upper()
+        # Types like ``Choice`` and ``DateTime`` already surround their metavar
+        # with square brackets to enumerate the allowed values. Reuse those
+        # outer brackets as the optional-argument indicator instead of wrapping
+        # the metavar in a second pair, which would produce ``[[a|b|c]]``.
+        already_bracketed = var.startswith("[") and var.endswith("]")
         if self.deprecated:
             var += "!"
-        if not self.required:
+        if not self.required and not already_bracketed:
             var = f"[{var}]"
         if self.nargs != 1:
             var += "..."
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +6/-1 | 16 | 2,035 | $0.095 |
| claude | muffle | pass | +4/-1 | 19 | 1,989 | $0.077 |
| claude | hush | pass | +2/-1 | 0 | 1,373 | $0.067 |
| claude | sloth | pass | +3/-1 | 20 | 2,220 | $0.087 |
| claude | all | pass | +1/-1 | 15 | 1,467 | $0.060 |
| codex | base | pass | +5/-0 | 36 | 1,763 | - |
| codex | muffle | pass | +5/-0 | 26 | 1,454 | - |
| codex | hush | pass | +1/-1 | 30 | 1,055 | - |
| codex | sloth | pass | +1/-1 | 27 | 1,321 | - |
| codex | all | pass | +1/-1 | 26 | 1,263 | - |

### claude, base: pass

Files: [CHANGES.md](../base/claude/python-click-choice-double-brackets-1/files/CHANGES.md), [src/click/core.py](../base/claude/python-click-choice-double-brackets-1/files/src/click/core.py), [tests/test_arguments.py](../base/claude/python-click-choice-double-brackets-1/files/tests/test_arguments.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGES.md b/CHANGES.md
index 8991e82..92f61c6 100644
--- a/CHANGES.md
+++ b/CHANGES.md
@@ -11,6 +11,9 @@ Unreleased
 - A {class}`Group` with `invoke_without_command=True` marks its subcommand as
   optional in the usage help, showing `[COMMAND]` instead of `COMMAND`.
   {issue}`3059` {pr}`3507`
+- Optional arguments of type {class}`Choice` or {class}`DateTime` no longer
+  show doubled square brackets in the usage help, e.g. `[foo|bar]` instead of
+  `[[foo|bar]]`.
 - `echo_via_pager` flushes after each write, so passing a generator streams
   output to the pager incrementally instead of staying hidden until the pipe
   buffer fills. {issue}`3242` {issue}`2542` {pr}`3534`
diff --git a/src/click/core.py b/src/click/core.py
index d2db291..2cec824 100644
--- a/src/click/core.py
+++ b/src/click/core.py
@@ -3571,9 +3571,11 @@ class Argument(Parameter):
         var = self.type.get_metavar(param=self, ctx=ctx)
         if not var:
             var = self.name.upper()
+        # Types like Choice and DateTime already bracket their metavar.
+        bracketed = var.startswith("[") and var.endswith("]")
         if self.deprecated:
             var += "!"
-        if not self.required:
+        if not self.required and not bracketed:
             var = f"[{var}]"
         if self.nargs != 1:
             var += "..."
diff --git a/tests/test_arguments.py b/tests/test_arguments.py
index 6015282..9b8c7b3 100644
--- a/tests/test_arguments.py
+++ b/tests/test_arguments.py
@@ -653,3 +653,19 @@ def test_argument_custom_class_can_override_type_cast_value_and_never_sees_unset
     result = runner.invoke(cmd, pass_argv)
     assert not result.exception
     assert result.exit_code == 0
+
+
+@pytest.mark.parametrize(
+    "type",
+    [click.Choice(["foo", "bar", "baz"]), click.DateTime(formats=["%Y-%m-%d"])],
+)
+@pytest.mark.parametrize("kwargs", [{"nargs": -1}, {"required": False}])
+def test_optional_bracketed_metavar_not_doubled(runner, type, kwargs):
+    @click.command()
+    @click.argument("method", type=type, **kwargs)
+    def cli(method):
+        pass
+
+    usage = runner.invoke(cli, ["--help"]).output.splitlines()[0]
+    assert "[[" not in usage
+    assert "]]" not in usage
```

</details>

<details><summary>reply</summary>

Optional arguments of type `Choice` or `DateTime` no longer get a second pair of brackets in the usage line. Your example now prints `Usage: cli.py [OPTIONS] [foo|bar|baz]...`, and the `DateTime` case prints `[%Y-%m-%d]`. The full test suite passes.

The fix is in `Argument.make_metavar` in `src/click/core.py`. Those types already return their metavar wrapped in `[...]`, and optional arguments then wrapped it a second time. It now skips the extra wrapping when the type's metavar is already bracketed. Required arguments and options are unchanged.

I added a test in `tests/test_arguments.py` covering both types with `nargs=-1` and with `required=False`, plus a changelog entry in `CHANGES.md`. I didn't commit anything.

</details>

### claude, muffle: pass

Files: [CHANGES.md](../muffle/claude/python-click-choice-double-brackets-1/files/CHANGES.md), [src/click/core.py](../muffle/claude/python-click-choice-double-brackets-1/files/src/click/core.py), [tests/test_arguments.py](../muffle/claude/python-click-choice-double-brackets-1/files/tests/test_arguments.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGES.md b/CHANGES.md
index 8991e82..6491367 100644
--- a/CHANGES.md
+++ b/CHANGES.md
@@ -11,6 +11,8 @@ Unreleased
 - A {class}`Group` with `invoke_without_command=True` marks its subcommand as
   optional in the usage help, showing `[COMMAND]` instead of `COMMAND`.
   {issue}`3059` {pr}`3507`
+- Optional arguments of type {class}`Choice` or {class}`DateTime` no longer
+  show doubled square brackets in the usage help.
 - `echo_via_pager` flushes after each write, so passing a generator streams
   output to the pager incrementally instead of staying hidden until the pipe
   buffer fills. {issue}`3242` {issue}`2542` {pr}`3534`
diff --git a/src/click/core.py b/src/click/core.py
index d2db291..35a3370 100644
--- a/src/click/core.py
+++ b/src/click/core.py
@@ -3573,7 +3573,8 @@ class Argument(Parameter):
             var = self.name.upper()
         if self.deprecated:
             var += "!"
-        if not self.required:
+        # Choice and DateTime metavars are already wrapped in square brackets.
+        if not self.required and not (var.startswith("[") and var.endswith("]")):
             var = f"[{var}]"
         if self.nargs != 1:
             var += "..."
diff --git a/tests/test_arguments.py b/tests/test_arguments.py
index 6015282..d7540a1 100644
--- a/tests/test_arguments.py
+++ b/tests/test_arguments.py
@@ -653,3 +653,22 @@ def test_argument_custom_class_can_override_type_cast_value_and_never_sees_unset
     result = runner.invoke(cmd, pass_argv)
     assert not result.exception
     assert result.exit_code == 0
+
+
+@pytest.mark.parametrize(
+    ("type", "kwargs", "expected"),
+    [
+        (click.Choice(["foo", "bar"]), {"nargs": -1}, "[foo|bar]..."),
+        (click.Choice(["foo", "bar"]), {"required": False}, "[foo|bar]"),
+        (click.Choice(["foo", "bar"]), {"required": True}, "{foo|bar}"),
+        (click.DateTime(formats=["%Y-%m-%d"]), {"required": False}, "[%Y-%m-%d]"),
+    ],
+)
+def test_optional_argument_metavar_single_brackets(runner, type, kwargs, expected):
+    @click.command()
+    @click.argument("method", type=type, **kwargs)
+    def cli(method):
+        pass
+
+    result = runner.invoke(cli, ["--help"])
+    assert f"[OPTIONS] {expected}" in result.output
```

</details>

<details><summary>reply</summary>

Optional arguments of type `Choice` or `DateTime` now show single brackets in `--help`. Your example gives `Usage: cli.py [OPTIONS] [foo|bar|baz]...`, and the `required=False` and `DateTime` cases are fixed the same way. The full test suite passes, and I haven't committed anything.

**Cause:** `Choice.get_metavar` and `DateTime.get_metavar` already wrap their output in `[...]`. `Argument.make_metavar` then wrapped it again for any argument that wasn't required.

**Fix:** In `src/click/core.py`, `Argument.make_metavar` now skips its own wrapping when the metavar already starts with `[` and ends with `]`. Required `Choice` arguments still render as `{foo|bar}`.

**Extra changes:**
- **Tests:** I added a parametrized test to `tests/test_arguments.py` covering optional, `nargs=-1`, required and `DateTime` arguments.
- **Changelog:** I added an entry to `CHANGES.md`.

The bracket check is a plain string test. A `Choice` whose first choice begins with `[` and whose last ends with `]` would be treated as already wrapped. For an optional argument that still displays a single pair of brackets, so the output is unaffected.

</details>

### claude, hush: pass

Files: [src/click/core.py](../hush/claude/python-click-choice-double-brackets-1/files/src/click/core.py)

<details><summary>diff</summary>

```diff
diff --git a/src/click/core.py b/src/click/core.py
index d2db291..4b2c8ae 100644
--- a/src/click/core.py
+++ b/src/click/core.py
@@ -3573,7 +3573,8 @@ class Argument(Parameter):
             var = self.name.upper()
         if self.deprecated:
             var += "!"
-        if not self.required:
+        # Choice and DateTime metavars are already bracketed.
+        if not self.required and not (var.startswith("[") and var.endswith("]")):
             var = f"[{var}]"
         if self.nargs != 1:
             var += "..."
```

</details>

<details><summary>reply</summary>

Done. `Argument.make_metavar` in `src/click/core.py` now skips the extra brackets when the type's metavar is already bracketed. Your example now prints `[foo|bar]... [%Y-%m-%d]`, and the test suite passes. I added no regression test.

</details>

### claude, sloth: pass

Files: [CHANGES.md](../sloth/claude/python-click-choice-double-brackets-1/files/CHANGES.md), [src/click/core.py](../sloth/claude/python-click-choice-double-brackets-1/files/src/click/core.py), [tests/test_arguments.py](../sloth/claude/python-click-choice-double-brackets-1/files/tests/test_arguments.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGES.md b/CHANGES.md
index 8991e82..706bdc8 100644
--- a/CHANGES.md
+++ b/CHANGES.md
@@ -2,6 +2,8 @@
 
 Unreleased
 
+- Optional arguments of type {class}`Choice` or {class}`DateTime` no longer
+  show doubled square brackets in the usage help.
 - Fix Fish shell completion broken in `8.4.0` by {pr}`3126`. Newlines and
   tabs in option help text are now escaped, keeping the original completion
   format while still supporting multi-line help. {issue}`3502`
diff --git a/src/click/core.py b/src/click/core.py
index d2db291..cd642b5 100644
--- a/src/click/core.py
+++ b/src/click/core.py
@@ -3573,7 +3573,7 @@ class Argument(Parameter):
             var = self.name.upper()
         if self.deprecated:
             var += "!"
-        if not self.required:
+        if not self.required and not (var.startswith("[") and var.endswith("]")):
             var = f"[{var}]"
         if self.nargs != 1:
             var += "..."
diff --git a/tests/test_arguments.py b/tests/test_arguments.py
index 6015282..ddca817 100644
--- a/tests/test_arguments.py
+++ b/tests/test_arguments.py
@@ -306,6 +306,26 @@ def test_deprecated_usage(runner):
     assert "[F!]" in result.output
 
 
+@pytest.mark.parametrize(
+    ("type", "kwargs", "expected"),
+    [
+        (click.Choice(["a", "b"]), {"required": False}, "[a|b]"),
+        (click.Choice(["a", "b"]), {"nargs": -1}, "[a|b]..."),
+        (click.Choice(["a", "b"]), {"required": True}, "{a|b}"),
+        (click.DateTime(formats=["%Y-%m-%d"]), {"required": False}, "[%Y-%m-%d]"),
+    ],
+)
+def test_argument_metavar_no_double_brackets(runner, type, kwargs, expected):
+    @click.command()
+    @click.argument("foo", type=type, **kwargs)
+    def cli(foo):
+        pass
+
+    result = runner.invoke(cli, ["--help"])
+    assert f"[OPTIONS] {expected}" in result.output
+    assert f"[{expected}]" not in result.output
+
+
 @pytest.mark.parametrize(
     ("kwargs", "expected"),
     [
```

</details>

<details><summary>reply</summary>

I'm fixing `Argument.make_metavar` so it doesn't wrap a metavar that is already bracketed, then adding a test.

Optional arguments of type `Choice` or `DateTime` no longer get a second pair of brackets in the usage line. Your example now prints `[OPTIONS] [foo|bar|baz]...`, and the full test suite passes.

The fix is in `Argument.make_metavar` in `src/click/core.py`. It now skips adding brackets when the type's metavar already starts with `[` and ends with `]`. Required arguments, which use `{a|b}`, and plain-type arguments such as `[FOO]` are unchanged.

I added `test_argument_metavar_no_double_brackets` in `tests/test_arguments.py`. It covers `Choice` with `required=False`, `nargs=-1` and `required=True`, plus `DateTime`. I also added a line to `CHANGES.md`.

The check is by text, so a custom type whose metavar happens to start with `[` and end with `]` (for example `[a]|[b]`) would also skip the extra brackets.

I didn't run the tests with `python -m pytest` alone, because `click` isn't installed in this environment. I ran them with `PYTHONPATH=src`.

</details>

### claude, all: pass

Files: [src/click/core.py](../all/claude/python-click-choice-double-brackets-1/files/src/click/core.py), [tests/test_arguments.py](../all/claude/python-click-choice-double-brackets-1/files/tests/test_arguments.py)

<details><summary>diff</summary>

```diff
diff --git a/src/click/core.py b/src/click/core.py
index d2db291..cd642b5 100644
--- a/src/click/core.py
+++ b/src/click/core.py
@@ -3573,7 +3573,7 @@ class Argument(Parameter):
             var = self.name.upper()
         if self.deprecated:
             var += "!"
-        if not self.required:
+        if not self.required and not (var.startswith("[") and var.endswith("]")):
             var = f"[{var}]"
         if self.nargs != 1:
             var += "..."
diff --git a/tests/test_arguments.py b/tests/test_arguments.py
index 6015282..371eab2 100644
--- a/tests/test_arguments.py
+++ b/tests/test_arguments.py
@@ -653,3 +653,18 @@ def test_argument_custom_class_can_override_type_cast_value_and_never_sees_unset
     result = runner.invoke(cmd, pass_argv)
     assert not result.exception
     assert result.exit_code == 0
+
+
+@pytest.mark.parametrize(
+    ("type", "metavar"),
+    [
+        (click.Choice(["foo", "bar"]), "[foo|bar]"),
+        (click.DateTime(formats=["%Y-%m-%d"]), "[%Y-%m-%d]"),
+    ],
+)
+@pytest.mark.parametrize("kwargs", [{"nargs": -1}, {"required": False}])
+def test_optional_argument_bracketed_metavar_not_doubled(type, metavar, kwargs):
+    arg = click.Argument(["a"], type=type, **kwargs)
+    ctx = click.Context(click.Command("cmd"))
+    expected = metavar + ("..." if kwargs.get("nargs") == -1 else "")
+    assert arg.make_metavar(ctx) == expected
```

</details>

<details><summary>reply</summary>

Done. `Argument.make_metavar` in `src/click/core.py` no longer wraps a metavar that already has brackets, so optional `Choice` and `DateTime` arguments show single brackets. I added a parametrized test in `tests/test_arguments.py`, and the full suite passes (1660 passed). I did not run `--help` on your exact example.

</details>

### codex, base: pass

Files: [CHANGES.md](../base/codex/python-click-choice-double-brackets-1/files/CHANGES.md), [src/click/core.py](../base/codex/python-click-choice-double-brackets-1/files/src/click/core.py), [tests/test_arguments.py](../base/codex/python-click-choice-double-brackets-1/files/tests/test_arguments.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGES.md b/CHANGES.md
index 8991e82..3640fde 100644
--- a/CHANGES.md
+++ b/CHANGES.md
@@ -2,6 +2,8 @@
 
 Unreleased
 
+- Optional arguments with a `Choice` or `DateTime` type no longer show
+  duplicate square brackets in usage help.
 - Fix Fish shell completion broken in `8.4.0` by {pr}`3126`. Newlines and
   tabs in option help text are now escaped, keeping the original completion
   format while still supporting multi-line help. {issue}`3502`
diff --git a/src/click/core.py b/src/click/core.py
index d2db291..06b402e 100644
--- a/src/click/core.py
+++ b/src/click/core.py
@@ -3571,6 +3571,9 @@ class Argument(Parameter):
         var = self.type.get_metavar(param=self, ctx=ctx)
         if not var:
             var = self.name.upper()
+        if not self.required and var.startswith("[") and var.endswith("]"):
+            # The type already indicates that the argument is optional.
+            var = var[1:-1]
         if self.deprecated:
             var += "!"
         if not self.required:
diff --git a/tests/test_arguments.py b/tests/test_arguments.py
index 6015282..d619450 100644
--- a/tests/test_arguments.py
+++ b/tests/test_arguments.py
@@ -332,6 +332,42 @@ def test_argument_metavar_marks_optional(runner, kwargs, expected):
     assert result.output.splitlines()[0] == f"Usage: cli [OPTIONS] {expected}"
 
 
+@pytest.mark.parametrize(
+    ("type", "optional", "required"),
+    [
+        (click.Choice(["foo", "bar", "baz"]), "[foo|bar|baz]", "{foo|bar|baz}"),
+        (click.DateTime(formats=["%Y-%m-%d"]), "[%Y-%m-%d]", "[%Y-%m-%d]"),
+    ],
+)
+@pytest.mark.parametrize(
+    ("kwargs", "deprecated"),
+    [
+        ({"required": False}, False),
+        ({"nargs": -1}, False),
+        ({"required": True}, False),
+        ({"required": False}, True),
+        ({"nargs": -1}, True),
+    ],
+)
+def test_argument_type_metavar_brackets(
+    runner, type, optional, required, kwargs, deprecated
+):
+    @click.command()
+    @click.argument("value", type=type, deprecated=deprecated, **kwargs)
+    def cli(value):
+        pass
+
+    expected = required if kwargs.get("required") else optional
+    if deprecated:
+        expected = expected[:-1] + "!]"
+    if kwargs.get("nargs") == -1:
+        expected += "..."
+
+    result = runner.invoke(cli, ["--help"])
+    assert result.exit_code == 0
+    assert result.output.splitlines()[0] == f"Usage: cli [OPTIONS] {expected}"
+
+
 @pytest.mark.parametrize("deprecated", [True, "USE B INSTEAD"])
 def test_deprecated_warning(runner, deprecated):
     @click.command()
```

</details>

<details><summary>reply</summary>

I’ll check how argument metavars are formatted, fix the extra brackets, and add regression coverage for both types.

The fix removes the redundant brackets while preserving required argument formatting and deprecated argument markers. Regression coverage is in place for `Choice` and `DateTime`; the full test suite is running now.

Fixed optional `Choice` and `DateTime` arguments to show one pair of brackets, including `[foo|bar|baz]...`. Required argument formatting stays unchanged.

Added regression tests and a changelog entry. Full suite: 1,666 passed. Ruff checks couldn’t run because Ruff isn’t installed.

</details>

### codex, muffle: pass

Files: [CHANGES.md](../muffle/codex/python-click-choice-double-brackets-1/files/CHANGES.md), [src/click/core.py](../muffle/codex/python-click-choice-double-brackets-1/files/src/click/core.py), [tests/test_arguments.py](../muffle/codex/python-click-choice-double-brackets-1/files/tests/test_arguments.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGES.md b/CHANGES.md
index 8991e82..1a68b0f 100644
--- a/CHANGES.md
+++ b/CHANGES.md
@@ -2,6 +2,8 @@
 
 Unreleased
 
+- Optional arguments with types such as `Choice` and `DateTime` no longer show
+  duplicate square brackets in usage help.
 - Fix Fish shell completion broken in `8.4.0` by {pr}`3126`. Newlines and
   tabs in option help text are now escaped, keeping the original completion
   format while still supporting multi-line help. {issue}`3502`
diff --git a/src/click/core.py b/src/click/core.py
index d2db291..a00c501 100644
--- a/src/click/core.py
+++ b/src/click/core.py
@@ -3571,6 +3571,9 @@ class Argument(Parameter):
         var = self.type.get_metavar(param=self, ctx=ctx)
         if not var:
             var = self.name.upper()
+        if not self.required and var.startswith("[") and var.endswith("]"):
+            # The type may already indicate that the argument is optional.
+            var = var[1:-1]
         if self.deprecated:
             var += "!"
         if not self.required:
diff --git a/tests/test_arguments.py b/tests/test_arguments.py
index 6015282..7dd48d5 100644
--- a/tests/test_arguments.py
+++ b/tests/test_arguments.py
@@ -332,6 +332,32 @@ def test_argument_metavar_marks_optional(runner, kwargs, expected):
     assert result.output.splitlines()[0] == f"Usage: cli [OPTIONS] {expected}"
 
 
+@pytest.mark.parametrize(
+    ("type", "optional", "required"),
+    [
+        (click.Choice(["foo", "bar", "baz"]), "[foo|bar|baz]", "{foo|bar|baz}"),
+        (click.DateTime(formats=["%Y-%m-%d"]), "[%Y-%m-%d]", "[%Y-%m-%d]"),
+    ],
+)
+@pytest.mark.parametrize("nargs", [1, 2, -1])
+@pytest.mark.parametrize("is_required", [False, True])
+def test_argument_type_metavar_brackets(
+    runner, type, optional, required, nargs, is_required
+):
+    @click.command()
+    @click.argument("value", type=type, nargs=nargs, required=is_required)
+    def cli(value):
+        pass
+
+    expected = required if is_required else optional
+    if nargs != 1:
+        expected += "..."
+
+    result = runner.invoke(cli, ["--help"])
+    assert result.exit_code == 0
+    assert result.output.splitlines()[0] == f"Usage: cli [OPTIONS] {expected}"
+
+
 @pytest.mark.parametrize("deprecated", [True, "USE B INSTEAD"])
 def test_deprecated_warning(runner, deprecated):
     @click.command()
```

</details>

<details><summary>reply</summary>

I’ll check how argument metavars are built, fix the extra brackets, and add regression coverage for Choice and DateTime.


Argument formatting adds brackets even when the type’s metavar already has them. The fix reuses that existing pair and preserves required arguments and `...`. I’ve added Choice and DateTime regression cases, and the full test suite is running.


Fixed optional Choice and DateTime arguments to display a single pair of square brackets, including with `nargs=-1`. Required argument formatting stays unchanged.

Added regression coverage and a changelog entry. Full test suite: 1,668 passed, 24 skipped, 1 expected failure.

</details>

### codex, hush: pass

Files: [src/click/core.py](../hush/codex/python-click-choice-double-brackets-1/files/src/click/core.py), [tests/test_arguments.py](../hush/codex/python-click-choice-double-brackets-1/files/tests/test_arguments.py)

<details><summary>diff</summary>

```diff
diff --git a/src/click/core.py b/src/click/core.py
index d2db291..cd642b5 100644
--- a/src/click/core.py
+++ b/src/click/core.py
@@ -3573,7 +3573,7 @@ class Argument(Parameter):
             var = self.name.upper()
         if self.deprecated:
             var += "!"
-        if not self.required:
+        if not self.required and not (var.startswith("[") and var.endswith("]")):
             var = f"[{var}]"
         if self.nargs != 1:
             var += "..."
diff --git a/tests/test_arguments.py b/tests/test_arguments.py
index 6015282..ee6adbf 100644
--- a/tests/test_arguments.py
+++ b/tests/test_arguments.py
@@ -332,6 +332,36 @@ def test_argument_metavar_marks_optional(runner, kwargs, expected):
     assert result.output.splitlines()[0] == f"Usage: cli [OPTIONS] {expected}"
 
 
+@pytest.mark.parametrize(
+    ("type", "metavar", "required_metavar"),
+    [
+        (click.Choice(["foo", "bar", "baz"]), "[foo|bar|baz]", "{foo|bar|baz}"),
+        (click.DateTime(formats=["%Y-%m-%d"]), "[%Y-%m-%d]", "[%Y-%m-%d]"),
+    ],
+)
+@pytest.mark.parametrize(
+    ("kwargs", "required", "suffix"),
+    [
+        ({"required": False}, False, ""),
+        ({"nargs": -1}, False, "..."),
+        ({"required": True}, True, ""),
+        ({"required": True, "nargs": -1}, True, "..."),
+    ],
+)
+def test_argument_bracketed_metavar(
+    runner, type, metavar, required_metavar, kwargs, required, suffix
+):
+    @click.command()
+    @click.argument("value", type=type, **kwargs)
+    def cli(value):
+        pass
+
+    result = runner.invoke(cli, ["--help"])
+    assert result.exit_code == 0
+    expected = required_metavar if required else metavar
+    assert result.output.splitlines()[0] == f"Usage: cli [OPTIONS] {expected}{suffix}"
+
+
 @pytest.mark.parametrize("deprecated", [True, "USE B INSTEAD"])
 def test_deprecated_warning(runner, deprecated):
     @click.command()
```

</details>

<details><summary>reply</summary>

Fix targets optional argument usage brackets; checking formatter and tests.


Done.
Optional arguments reuse existing brackets. Choice/DateTime regression tests added. Suite: 1664 passed, 24 skipped, 31000 deselected, 1 xfailed.

</details>

### codex, sloth: pass

Files: [src/click/core.py](../sloth/codex/python-click-choice-double-brackets-1/files/src/click/core.py), [tests/test_arguments.py](../sloth/codex/python-click-choice-double-brackets-1/files/tests/test_arguments.py)

<details><summary>diff</summary>

```diff
diff --git a/src/click/core.py b/src/click/core.py
index d2db291..cd642b5 100644
--- a/src/click/core.py
+++ b/src/click/core.py
@@ -3573,7 +3573,7 @@ class Argument(Parameter):
             var = self.name.upper()
         if self.deprecated:
             var += "!"
-        if not self.required:
+        if not self.required and not (var.startswith("[") and var.endswith("]")):
             var = f"[{var}]"
         if self.nargs != 1:
             var += "..."
diff --git a/tests/test_arguments.py b/tests/test_arguments.py
index 6015282..3f239b3 100644
--- a/tests/test_arguments.py
+++ b/tests/test_arguments.py
@@ -7,6 +7,33 @@ import click
 from click._utils import UNSET
 
 
+@pytest.mark.parametrize(
+    ("type", "optional", "required"),
+    [
+        (click.Choice(["foo", "bar", "baz"]), "[foo|bar|baz]", "{foo|bar|baz}"),
+        (click.DateTime(formats=["%Y-%m-%d"]), "[%Y-%m-%d]", "[%Y-%m-%d]"),
+        (str, "[METHOD]", "METHOD"),
+    ],
+)
+@pytest.mark.parametrize(
+    "attrs", [{"nargs": -1}, {"required": False}, {"required": True}]
+)
+def test_argument_metavar_brackets(runner, type, optional, required, attrs):
+    """Optional arguments reuse brackets already supplied by their type."""
+
+    @click.command()
+    @click.argument("method", type=type, **attrs)
+    def cli(method):
+        """Show the argument's metavar."""
+
+    result = runner.invoke(cli, ["--help"])
+    assert result.exit_code == 0
+    metavar = required if attrs.get("required") else optional
+    if attrs.get("nargs") == -1:
+        metavar += "..."
+    assert result.output.splitlines()[0] == f"Usage: cli [OPTIONS] {metavar}"
+
+
 def test_nargs_star(runner):
     @click.command()
     @click.argument("src", nargs=-1)
```

</details>

<details><summary>reply</summary>

I’ll check how argument metavars are built and where they’re used, then make a focused fix and run the tests.

The extra brackets come from `Argument.make_metavar`, which adds an optional wrapper even when the type already supplies one. I’ll fix that shared method, covering help usage and error hints, and add a parameterized regression test. Type formatting, options, explicit metavars, and required arguments will stay unchanged; no config or export changes are needed.

Fixed optional argument formatting to reuse square brackets already supplied by `Choice` and `DateTime`, producing `[foo|bar|baz]...` as expected.

Added regression coverage for optional, variadic, required, and plain string arguments.

Validation: 1,665 tests passed; wheel build succeeded.

</details>

### codex, all: pass

Files: [src/click/core.py](../all/codex/python-click-choice-double-brackets-1/files/src/click/core.py), [tests/test_arguments.py](../all/codex/python-click-choice-double-brackets-1/files/tests/test_arguments.py)

<details><summary>diff</summary>

```diff
diff --git a/src/click/core.py b/src/click/core.py
index d2db291..cd642b5 100644
--- a/src/click/core.py
+++ b/src/click/core.py
@@ -3573,7 +3573,7 @@ class Argument(Parameter):
             var = self.name.upper()
         if self.deprecated:
             var += "!"
-        if not self.required:
+        if not self.required and not (var.startswith("[") and var.endswith("]")):
             var = f"[{var}]"
         if self.nargs != 1:
             var += "..."
diff --git a/tests/test_arguments.py b/tests/test_arguments.py
index 6015282..22e6024 100644
--- a/tests/test_arguments.py
+++ b/tests/test_arguments.py
@@ -317,6 +317,32 @@ def test_deprecated_usage(runner):
         ({"nargs": -1, "required": True}, "FOO..."),
         ({"nargs": 2}, "FOO..."),
         ({"nargs": 2, "required": False}, "[FOO]..."),
+        ({"type": click.Choice(["foo", "bar", "baz"])}, "{foo|bar|baz}"),
+        (
+            {"type": click.Choice(["foo", "bar", "baz"]), "required": False},
+            "[foo|bar|baz]",
+        ),
+        (
+            {"type": click.Choice(["foo", "bar", "baz"]), "nargs": -1},
+            "[foo|bar|baz]...",
+        ),
+        (
+            {"type": click.Choice(["foo", "bar", "baz"]), "nargs": -1, "required": True},
+            "{foo|bar|baz}...",
+        ),
+        ({"type": click.DateTime(formats=["%Y-%m-%d"])}, "[%Y-%m-%d]"),
+        (
+            {"type": click.DateTime(formats=["%Y-%m-%d"]), "required": False},
+            "[%Y-%m-%d]",
+        ),
+        (
+            {"type": click.DateTime(formats=["%Y-%m-%d"]), "nargs": -1},
+            "[%Y-%m-%d]...",
+        ),
+        (
+            {"type": click.DateTime(formats=["%Y-%m-%d"]), "nargs": -1, "required": True},
+            "[%Y-%m-%d]...",
+        ),
     ],
 )
 def test_argument_metavar_marks_optional(runner, kwargs, expected):
```

</details>

<details><summary>reply</summary>

Fix shared argument metavar formatting; check Choice, DateTime, required arguments, and tests.


Done.
Optional Choice/DateTime arguments avoid double brackets; required arguments preserved. Regression tests added. 1664 tests passed; wheel built.

</details>
