# python-marshmallow-constant-required

Source: https://github.com/marshmallow-code/marshmallow/pull/2901

## Prompt

> I have a schema containing a `fields.Constant` with `required=True` set, because the schema is exported to an OpenAPI spec and the field must be marked as required there. Since the latest release this no longer works; defining the field fails:
> 
> ```python
> from marshmallow import Schema, fields
> 
> class MySchema(Schema):
>     foo = fields.Constant(42, required=True)
> ```
> 
> ```
> ValueError: 'load_default' must not be set for required fields.
> ```
> 
> This used to work. I expect a required `Constant` to be accepted, and loading to always give the constant, whether the field is missing from the input or set to something else (`MySchema().load({})` and `MySchema().load({"foo": 99})` should both give `{"foo": 42}`). `Constant(None)` should keep working too.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [AUTHORS.rst](../../tasks/python-marshmallow-constant-required/upstream/AUTHORS.rst), [CHANGELOG.rst](../../tasks/python-marshmallow-constant-required/upstream/CHANGELOG.rst), [src/marshmallow/fields.py](../../tasks/python-marshmallow-constant-required/upstream/src/marshmallow/fields.py), [tests/test_deserialization.py](../../tasks/python-marshmallow-constant-required/upstream/tests/test_deserialization.py)

```diff
diff --git a/AUTHORS.rst b/AUTHORS.rst
index 4f8538f..5f4d862 100644
--- a/AUTHORS.rst
+++ b/AUTHORS.rst
@@ -184,3 +184,5 @@ Contributors (chronological)
 - jfo `@jafournier <https://github.com/jafournier>`_
 - thanhlecongg `@thanhlecongg <https://github.com/thanhlecongg>`_
 - Emmanuel Ferdman  `@emmanuel-ferdman  <https://github.com/emmanuel-ferdman>`_
+- Fridayworks  `@worksbyfriday  <https://github.com/worksbyfriday`_
+
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index 8b90369..6723c9e 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -8,6 +8,8 @@ Bug fixes:
 
 - Make `marshmallow.fields.Number` and `marshmallow.fields.Mapping` abstract base classes to
   prevent using them within Schemas (:issue:`2924`). Thanks :user:`MartingaleCoda` for reporting.
+- Allow `required` to be set on `marshmallow.fields.Contant` (:issue:`2900`).
+  Thanks :user:`nosnickid` for the report and :user:`worksbyfriday` for the PR.
 
 
 4.2.2 (2026-02-04)
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index b081b4b..1c2e72e 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,10 +2074,20 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
-        kwargs["load_default"] = constant
-        kwargs["dump_default"] = constant
         super().__init__(**kwargs)
         self.constant = constant
+        self.load_default = constant
+        self.dump_default = constant
+        # If allow_none was not explicitly provided and the constant is None,
+        # None should be considered valid (mirrors Field.__init__ logic).
+        if kwargs.get("allow_none") is None and constant is None:
+            self.allow_none = True
+
+    def _validate_missing(self, value):
+        # Omit check for value is missing_
+        # Below is just a paranoid check
+        if value is None and not self.allow_none:
+            raise self.make_error("null")
 
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +12/-0 | 16 | 2,762 | $0.096 |
| claude | muffle | pass | +12/-0 | 10 | 2,278 | $0.086 |
| claude | hush | pass | +8/-0 | 0 | 1,375 | $0.070 |
| claude | sloth | pass | +6/-0 | 0 | 2,028 | $0.083 |
| claude | all | pass | +7/-0 | 0 | 1,636 | $0.073 |
| codex | base | pass | +11/-1 | 7 | 1,498 | - |
| codex | muffle | pass | +8/-3 | 8 | 1,665 | - |
| codex | hush | pass | +9/-0 | 7 | 1,114 | - |
| codex | sloth | pass | +10/-1 | 0 | 1,444 | - |
| codex | all | pass | +8/-0 | 0 | 1,302 | - |

### claude, base: pass

Files: [CHANGELOG.rst](../base/claude/python-marshmallow-constant-required-1/files/CHANGELOG.rst), [src/marshmallow/fields.py](../base/claude/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py), [tests/test_fields.py](../base/claude/python-marshmallow-constant-required-1/files/tests/test_fields.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index 8b90369..dd8b725 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -8,6 +8,7 @@ Bug fixes:
 
 - Make `marshmallow.fields.Number` and `marshmallow.fields.Mapping` abstract base classes to
   prevent using them within Schemas (:issue:`2924`). Thanks :user:`MartingaleCoda` for reporting.
+- Fix `marshmallow.fields.Constant` raising `ValueError` when ``required=True``.
 
 
 4.2.2 (2026-02-04)
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..4dc8502 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,22 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
+        # A constant always has a load_default, so ``required`` can't be passed
+        # to the base class, which forbids that combination. Set it afterwards
+        # so the field is still reported as required (e.g. in OpenAPI specs).
+        required = kwargs.pop("required", False)
         kwargs["load_default"] = constant
         kwargs["dump_default"] = constant
         super().__init__(**kwargs)
+        self.required = required
         self.constant = constant
 
+    def _validate_missing(self, value) -> None:
+        # A missing value deserializes to the constant, even if required
+        if value is missing_:
+            return
+        super()._validate_missing(value)
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
 
diff --git a/tests/test_fields.py b/tests/test_fields.py
index a0d810b..b812711 100644
--- a/tests/test_fields.py
+++ b/tests/test_fields.py
@@ -631,3 +631,19 @@ class TestDictNested:
                     "daughter": {"value": {"age": ["Missing data for required field."]}}
                 }
             }
+
+
+class TestConstant:
+    def test_required_constant(self):
+        class MySchema(Schema):
+            foo = fields.Constant(42, required=True)
+
+        assert MySchema().fields["foo"].required is True
+        assert MySchema().load({}) == {"foo": 42}
+        assert MySchema().load({"foo": 99}) == {"foo": 42}
+
+    def test_required_none_constant(self):
+        class MySchema(Schema):
+            foo = fields.Constant(None, required=True)
+
+        assert MySchema().load({}) == {"foo": None}
```

</details>

<details><summary>reply</summary>

Edit applied; the package isn't installed, so I'm re-running the check with `PYTHONPATH=src`.

Now a test and changelog entry.

`fields.Constant(42, required=True)` now defines without error and is still reported as required, so your OpenAPI export keeps working. The full test suite passes, including the new tests.

- **Loading:** `MySchema().load({})` and `MySchema().load({"foo": 99})` both give `{"foo": 42}`.
- **`Constant(None)`:** `fields.Constant(None, required=True)` loads `{"foo": None}`, and the default `Constant(None)` behaves as before.
- **Cause:** `Constant` always sets a `load_default`, and the base `Field` rejects `required=True` together with one.
- **Fix:** `Constant` now keeps `required` out of the base-class check and sets it afterwards. It also overrides `_validate_missing` so a missing value yields the constant instead of a "required" error. The change is in `src/marshmallow/fields.py`.

I also added two tests in `tests/test_fields.py` and a bug-fix entry in `CHANGELOG.rst`. Nothing is committed.

</details>

### claude, muffle: pass

Files: [CHANGELOG.rst](../muffle/claude/python-marshmallow-constant-required-1/files/CHANGELOG.rst), [src/marshmallow/fields.py](../muffle/claude/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py), [tests/test_deserialization.py](../muffle/claude/python-marshmallow-constant-required-1/files/tests/test_deserialization.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index 8b90369..9a36bd4 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -6,6 +6,8 @@ Changelog
 
 Bug fixes:
 
+- Fix `marshmallow.fields.Constant` raising ``ValueError`` when ``required=True``.
+  A required ``Constant`` always loads as the constant, even if missing from the input.
 - Make `marshmallow.fields.Number` and `marshmallow.fields.Mapping` abstract base classes to
   prevent using them within Schemas (:issue:`2924`). Thanks :user:`MartingaleCoda` for reporting.
 
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..4cd6be7 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,21 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
+        # ``required`` is applied after init, since the base class forbids it
+        # together with ``load_default``. A required Constant is still always
+        # loaded as the constant, whether the input is missing or not.
+        required = kwargs.pop("required", False)
         kwargs["load_default"] = constant
         kwargs["dump_default"] = constant
         super().__init__(**kwargs)
+        self.required = required
         self.constant = constant
 
+    def _validate_missing(self, value) -> None:
+        if value is missing_:
+            return
+        super()._validate_missing(value)
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
 
diff --git a/tests/test_deserialization.py b/tests/test_deserialization.py
index 7cbe28e..fcd54ad 100644
--- a/tests/test_deserialization.py
+++ b/tests/test_deserialization.py
@@ -1413,6 +1413,16 @@ class TestFieldDeserialization:
         assert sch.load({})["foo"] == 42
         assert sch.load({"foo": 24})["foo"] == 42
 
+    def test_required_constant_is_always_included_in_deserialized_data(self):
+        class MySchema(Schema):
+            foo = fields.Constant(42, required=True)
+            bar = fields.Constant(None, required=True)
+
+        sch = MySchema()
+        assert sch.fields["foo"].required is True
+        assert sch.load({}) == {"foo": 42, "bar": None}
+        assert sch.load({"foo": 99}) == {"foo": 42, "bar": None}
+
     def test_constant_none_allows_none_value(self):
         class MySchema(Schema):
             foo = fields.Constant(None)
```

</details>

<details><summary>reply</summary>

`fields.Constant(42, required=True)` now works again. Both `MySchema().load({})` and `MySchema().load({"foo": 99})` give `{"foo": 42}`. The full test suite passes (1137 tests), including a new one.

The fix is in `Constant.__init__` in `src/marshmallow/fields.py`. `Constant` always sets `load_default` to the constant, and a recent change makes the base `Field` reject `load_default` together with `required=True`. `Constant` now takes `required` out of its arguments before calling the base constructor and sets it afterwards. Its `_validate_missing` override skips the "missing required field" error, so the constant is loaded instead. The field still reports `required=True`, so the OpenAPI export marks it as required.

`Constant(None)` still works, including with `required=True`.

I added `test_required_constant_is_always_included_in_deserialized_data` to `tests/test_deserialization.py`. It covers `Constant(42)` and `Constant(None)`, each with `required=True`. I also added a bug-fix entry to `CHANGELOG.rst`. Nothing is committed.

</details>

### claude, hush: pass

Files: [src/marshmallow/fields.py](../hush/claude/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py)

<details><summary>diff</summary>

```diff
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..c993330 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,19 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
+        required = kwargs.pop("required", False)
         kwargs["load_default"] = constant
         kwargs["dump_default"] = constant
         super().__init__(**kwargs)
+        # Set after init: the constant is the load default, which required
+        # fields normally forbid. Useful for marking the field required in schema specs.
+        self.required = required
         self.constant = constant
 
+    def _validate_missing(self, value) -> None:
+        # Loading always yields the constant, so nothing can be missing or invalid
+        pass
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
```

</details>

<details><summary>reply</summary>

Done. `Constant` in `src/marshmallow/fields.py` now accepts `required=True`, and `load({})` and `load({"foo": 99})` both give `{"foo": 42}`. `Constant(None)` still works. The 1136 existing tests pass, but I added no new test for the required case.

- **How:** it sets `required` after `super().__init__`, so the "load_default must not be set" check is skipped, and it overrides `_validate_missing` to do nothing.
- **Side effect:** `load({"foo": None})` now also gives `42` rather than a "may not be null" error. Say if you'd rather keep the null error.

</details>

### claude, sloth: pass

Files: [src/marshmallow/fields.py](../sloth/claude/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py)

<details><summary>diff</summary>

```diff
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..2d1a0a4 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,17 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
+        required = kwargs.pop("required", False)
         kwargs["load_default"] = constant
         kwargs["dump_default"] = constant
         super().__init__(**kwargs)
+        self.required = required
         self.constant = constant
 
+    def _validate_missing(self, value) -> None:
+        if value is not missing_:
+            super()._validate_missing(value)
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
```

</details>

<details><summary>reply</summary>

Fix is in; now re-running the check and tests with `src` on the path.

`fields.Constant(42, required=True)` now works: the field keeps `required=True` for your OpenAPI export, and loading always gives the constant.

I checked it by hand:
- `MySchema().load({})` and `MySchema().load({"foo": 99})` both return `{"foo": 42}`.
- `Constant(None, required=True)` loads to `{"foo": None}` in both cases.

The existing test suite passes (1136 tests). I didn't add a test for the required case, since you didn't ask for one.

The change is in `Constant.__init__` in `src/marshmallow/fields.py`. It no longer passes `required` up to `Field`, whose check was what raised the error. It sets `self.required` afterwards, and the "required" check is skipped when the field is missing from the input.

I haven't committed anything.

</details>

### claude, all: pass

Files: [src/marshmallow/fields.py](../all/claude/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py)

<details><summary>diff</summary>

```diff
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..9d6d677 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,9 +2074,11 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
+        required = kwargs.pop("required", False)
         kwargs["load_default"] = constant
         kwargs["dump_default"] = constant
         super().__init__(**kwargs)
+        self.required = required
         self.constant = constant
 
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
@@ -2085,6 +2087,11 @@ class Constant(Field[_ContantT]):
     def _deserialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
 
+    def _validate_missing(self, value: typing.Any) -> None:
+        """A missing constant is never an error; ``required`` only marks the field."""
+        if value is not missing_:
+            super()._validate_missing(value)
+
 
 # Aliases
 URL = Url
```

</details>

<details><summary>reply</summary>

Done. `Constant` in `src/marshmallow/fields.py` now accepts `required=True`, and the field still reports `required` for OpenAPI export. `load({})` and `load({"foo": 99})` both give `{"foo": 42}`, `Constant(None, required=True)` loads `{"foo": None}`, and all 1136 tests pass. I didn't add tests for the new case.

</details>

### codex, base: pass

Files: [CHANGELOG.rst](../base/codex/python-marshmallow-constant-required-1/files/CHANGELOG.rst), [src/marshmallow/fields.py](../base/codex/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py), [tests/test_deserialization.py](../base/codex/python-marshmallow-constant-required-1/files/tests/test_deserialization.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index 8b90369..1d92d0d 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -6,6 +6,8 @@ Changelog
 
 Bug fixes:
 
+- Restore support for ``fields.Constant`` with ``required=True``, including
+  loading the constant when the input field is missing.
 - Make `marshmallow.fields.Number` and `marshmallow.fields.Mapping` abstract base classes to
   prevent using them within Schemas (:issue:`2924`). Thanks :user:`MartingaleCoda` for reporting.
 
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..257523c 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,19 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
-        kwargs["load_default"] = constant
+        kwargs["load_default"] = missing_
         kwargs["dump_default"] = constant
+        if kwargs.get("allow_none") is None:
+            kwargs["allow_none"] = constant is None
         super().__init__(**kwargs)
+        self.load_default = constant
         self.constant = constant
 
+    def _validate_missing(self, value: typing.Any) -> None:
+        # Missing input always resolves to the constant, even for required fields.
+        if value is not missing_:
+            super()._validate_missing(value)
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
 
diff --git a/tests/test_deserialization.py b/tests/test_deserialization.py
index 7cbe28e..ebc0b7b 100644
--- a/tests/test_deserialization.py
+++ b/tests/test_deserialization.py
@@ -1405,17 +1405,20 @@ class TestFieldDeserialization:
         field = fields.Constant("something")
         assert field.deserialize("whatever") == "something"
 
-    def test_constant_is_always_included_in_deserialized_data(self):
+    @pytest.mark.parametrize("required", [True, False])
+    def test_constant_is_always_included_in_deserialized_data(self, required):
         class MySchema(Schema):
-            foo = fields.Constant(42)
+            foo = fields.Constant(42, required=required)
 
         sch = MySchema()
+        assert sch.fields["foo"].required is required
         assert sch.load({})["foo"] == 42
         assert sch.load({"foo": 24})["foo"] == 42
 
-    def test_constant_none_allows_none_value(self):
+    @pytest.mark.parametrize("required", [True, False])
+    def test_constant_none_allows_none_value(self, required):
         class MySchema(Schema):
-            foo = fields.Constant(None)
+            foo = fields.Constant(None, required=required)
 
         sch = MySchema()
         assert sch.load({"foo": None})["foo"] is None
```

</details>

<details><summary>reply</summary>

I’ll check how `Constant` handles defaults, fix the regression, and add tests for the loading behavior you described.

`Constant` now passes its value as `load_default` during initialization, which conflicts with `required=True`. I’ll set its defaults after initialization and let missing input use the constant, while preserving `Constant(None)` behavior.

Fixed `fields.Constant(..., required=True)`. Missing input now loads the constant, and supplied values are replaced with it. `Constant(None)` still works, and `required=True` remains available for schema export.

Added regression coverage and a changelog entry. All 1,138 tests pass.

</details>

### codex, muffle: pass

Files: [CHANGELOG.rst](../muffle/codex/python-marshmallow-constant-required-1/files/CHANGELOG.rst), [src/marshmallow/fields.py](../muffle/codex/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py), [tests/test_deserialization.py](../muffle/codex/python-marshmallow-constant-required-1/files/tests/test_deserialization.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index 8b90369..7cc9280 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -6,6 +6,8 @@ Changelog
 
 Bug fixes:
 
+- Allow ``fields.Constant`` with ``required=True`` and always deserialize to the constant.
+
 - Make `marshmallow.fields.Number` and `marshmallow.fields.Mapping` abstract base classes to
   prevent using them within Schemas (:issue:`2924`). Thanks :user:`MartingaleCoda` for reporting.
 
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..8b6986a 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,15 +2074,18 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
-        kwargs["load_default"] = constant
-        kwargs["dump_default"] = constant
+        kwargs.pop("load_default", None)
+        kwargs.pop("dump_default", None)
+        if kwargs.get("allow_none") is None:
+            kwargs["allow_none"] = constant is None
         super().__init__(**kwargs)
+        self.load_default = self.dump_default = constant
         self.constant = constant
 
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
 
-    def _deserialize(self, value, *args, **kwargs) -> _ContantT:
+    def deserialize(self, value, attr=None, data=None, **kwargs) -> _ContantT:
         return self.constant
 
 
diff --git a/tests/test_deserialization.py b/tests/test_deserialization.py
index 7cbe28e..a056dfc 100644
--- a/tests/test_deserialization.py
+++ b/tests/test_deserialization.py
@@ -1405,13 +1405,17 @@ class TestFieldDeserialization:
         field = fields.Constant("something")
         assert field.deserialize("whatever") == "something"
 
-    def test_constant_is_always_included_in_deserialized_data(self):
+    @pytest.mark.parametrize("required", [False, True])
+    @pytest.mark.parametrize("constant", [42, None])
+    def test_constant_is_always_included_in_deserialized_data(self, required, constant):
         class MySchema(Schema):
-            foo = fields.Constant(42)
+            foo = fields.Constant(constant, required=required)
 
         sch = MySchema()
-        assert sch.load({})["foo"] == 42
-        assert sch.load({"foo": 24})["foo"] == 42
+        assert sch.fields["foo"].required is required
+        assert sch.load({}) == {"foo": constant}
+        assert sch.load({"foo": 24}) == {"foo": constant}
+        assert sch.load({"foo": None}) == {"foo": constant}
 
     def test_constant_none_allows_none_value(self):
         class MySchema(Schema):
```

</details>

<details><summary>reply</summary>

I’ll check `Constant`’s initialization and load behavior, add regression coverage, and run the relevant tests.

`Constant` passes its value as a load default to the base field, which rejects defaults on required fields. I’ll give `Constant` its own deserialization path so it always returns the preset value, and keep the default validation rule for ordinary fields.

Fixed `Constant(required=True)` to preserve the required flag and always load the constant, including when input is missing or different. `Constant(None)` also works.

Added regression coverage and a changelog entry. All 1,139 tests pass.

</details>

### codex, hush: pass

Files: [CHANGELOG.rst](../hush/codex/python-marshmallow-constant-required-1/files/CHANGELOG.rst), [src/marshmallow/fields.py](../hush/codex/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py), [tests/test_deserialization.py](../hush/codex/python-marshmallow-constant-required-1/files/tests/test_deserialization.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index 8b90369..b203a49 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -6,6 +6,9 @@ Changelog
 
 Bug fixes:
 
+- Fix ``fields.Constant`` with ``required=True`` to accept missing input while
+  preserving the constant value and required metadata.
+
 - Make `marshmallow.fields.Number` and `marshmallow.fields.Mapping` abstract base classes to
   prevent using them within Schemas (:issue:`2924`). Thanks :user:`MartingaleCoda` for reporting.
 
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..75cc27d 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,17 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
+        required = kwargs.pop("required", False)
         kwargs["load_default"] = constant
         kwargs["dump_default"] = constant
         super().__init__(**kwargs)
+        self.required = required
         self.constant = constant
 
+    def _validate_missing(self, value: typing.Any) -> None:
+        if value is not missing_:
+            super()._validate_missing(value)
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
 
diff --git a/tests/test_deserialization.py b/tests/test_deserialization.py
index 7cbe28e..ebc0b7b 100644
--- a/tests/test_deserialization.py
+++ b/tests/test_deserialization.py
@@ -1405,17 +1405,20 @@ class TestFieldDeserialization:
         field = fields.Constant("something")
         assert field.deserialize("whatever") == "something"
 
-    def test_constant_is_always_included_in_deserialized_data(self):
+    @pytest.mark.parametrize("required", [True, False])
+    def test_constant_is_always_included_in_deserialized_data(self, required):
         class MySchema(Schema):
-            foo = fields.Constant(42)
+            foo = fields.Constant(42, required=required)
 
         sch = MySchema()
+        assert sch.fields["foo"].required is required
         assert sch.load({})["foo"] == 42
         assert sch.load({"foo": 24})["foo"] == 42
 
-    def test_constant_none_allows_none_value(self):
+    @pytest.mark.parametrize("required", [True, False])
+    def test_constant_none_allows_none_value(self, required):
         class MySchema(Schema):
-            foo = fields.Constant(None)
+            foo = fields.Constant(None, required=required)
 
         sch = MySchema()
         assert sch.load({"foo": None})["foo"] is None
```

</details>

<details><summary>reply</summary>

Done.
Required `Constant` accepts missing input, preserves required metadata, returns constant. `Constant(None)` works. Regression tests added; 1,138 tests passed.

</details>

### codex, sloth: pass

Files: [src/marshmallow/fields.py](../sloth/codex/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py)

<details><summary>diff</summary>

```diff
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..86f174f 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,20 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
-        kwargs["load_default"] = constant
+        """Initialize the field with its constant value."""
+        kwargs["load_default"] = missing_
         kwargs["dump_default"] = constant
+        if kwargs.get("allow_none") is None:
+            kwargs["allow_none"] = constant is None
         super().__init__(**kwargs)
+        self.load_default = constant
         self.constant = constant
 
+    def _validate_missing(self, value: typing.Any) -> None:
+        """Allow missing input to use the constant, even for required fields."""
+        if value is not missing_:
+            super()._validate_missing(value)
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
```

</details>

<details><summary>reply</summary>

I’ll check how `Constant` handles defaults and loading, make the smallest fix, then run the existing tests.

The conflict comes from `Constant` setting a load default that the base field rejects with `required=True`. I’ll keep the fix inside `Constant`, preserving its `required` metadata and allowing missing input to use the constant. Schema loading and collection fields already use the shared field methods, so no callers, fixtures, config, or exports need changes. I’ll preserve the existing `None` and validation behavior and add no new options or tests.

Fixed `Constant` to accept `required=True` while preserving the required metadata. Missing input returns the constant, supplied values resolve to the constant, and `Constant(None)` still works.

Verified the requested examples, all 1,136 existing tests passed, and the package built successfully.

</details>

### codex, all: pass

Files: [src/marshmallow/fields.py](../all/codex/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py)

<details><summary>diff</summary>

```diff
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..376c1dc 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,19 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
+        """Initialize a field with a constant value."""
         kwargs["load_default"] = constant
         kwargs["dump_default"] = constant
+        required = kwargs.pop("required", False)
         super().__init__(**kwargs)
+        self.required = required
         self.constant = constant
 
+    def _validate_missing(self, value: typing.Any) -> None:
+        """Validate null input while allowing missing input."""
+        if value is not missing_:
+            super()._validate_missing(value)
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
```

</details>

<details><summary>reply</summary>

Constant defaults conflict with required validation. Checking shared field logic and existing tests.


Done.
Required `Constant` accepts missing input, preserves constant values and `None`. All 1,136 tests passed; wheel built.

</details>
