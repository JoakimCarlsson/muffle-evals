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
| claude | muffle | pass | +12/-0 | 0 | 1,891 | $0.064 |
| claude | hush | pass | +10/-0 | 0 | 1,434 | $0.074 |
| claude | sloth | pass | +8/-0 | 10 | 2,716 | $0.095 |
| claude | all | pass | +6/-0 | 10 | 2,181 | $0.075 |
| codex | base | pass | +11/-1 | 7 | 1,498 | - |
| codex | muffle | pass | +12/-2 | 7 | 1,241 | - |
| codex | hush | pass | +11/-1 | 7 | 1,200 | - |
| codex | sloth | pass | +7/-0 | 8 | 1,479 | - |
| codex | all | pass | +9/-1 | 8 | 1,361 | - |

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

Files: [CHANGELOG.rst](../muffle/claude/python-marshmallow-constant-required-1/files/CHANGELOG.rst), [src/marshmallow/fields.py](../muffle/claude/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index 8b90369..7323364 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -6,6 +6,8 @@ Changelog
 
 Bug fixes:
 
+- Allow ``required=True`` on `marshmallow.fields.Constant`. The constant is still
+  loaded when the field is missing.
 - Make `marshmallow.fields.Number` and `marshmallow.fields.Mapping` abstract base classes to
   prevent using them within Schemas (:issue:`2924`). Thanks :user:`MartingaleCoda` for reporting.
 
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..e01a91e 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,21 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
+        # A required Constant is still always loaded as the constant, so
+        # ``required`` is only kept as a flag (e.g. for OpenAPI generation).
+        required = kwargs.pop("required", False)
         kwargs["load_default"] = constant
         kwargs["dump_default"] = constant
         super().__init__(**kwargs)
+        self.required = required
         self.constant = constant
 
+    def _validate_missing(self, value) -> None:
+        # A missing value is never an error: the constant is used instead.
+        if value is missing_:
+            return
+        super()._validate_missing(value)
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
```

</details>

<details><summary>reply</summary>

Fix is in; now I'll verify it and run the tests.

`fields.Constant(42, required=True)` is accepted again. I haven't added a regression test for it.

- `MySchema().load({})` and `MySchema().load({"foo": 99})` both give `{"foo": 42}`.
- `Constant(None, required=True)` loads `{"foo": None}`.
- The field still reports `required=True`, so your OpenAPI export still marks it required.
- The existing suite passes (1136 tests).

**Cause:** `Constant` always passes `load_default=constant` to the base `Field`. The latest release added a check that rejects `load_default` on required fields, so `required=True` now raises.

**Fix:** `Constant.__init__` in `src/marshmallow/fields.py` now takes `required` out of the arguments and sets it on the field after the base class is initialised. `Constant` also overrides `_validate_missing` so a missing value never raises the "required" error. I added a bug-fix line to `CHANGELOG.rst`.

I didn't commit anything.

</details>

### claude, hush: pass

Files: [src/marshmallow/fields.py](../hush/claude/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py)

<details><summary>diff</summary>

```diff
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..ab038b9 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,21 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
+        # A required Constant is still always loaded as the constant, so
+        # ``required`` is set after init to bypass the load_default check.
+        required = kwargs.pop("required", False)
         kwargs["load_default"] = constant
         kwargs["dump_default"] = constant
         super().__init__(**kwargs)
+        self.required = required
         self.constant = constant
 
+    def _validate_missing(self, value) -> None:
+        # A missing value is never an error: the constant is used instead.
+        if value is missing_:
+            return
+        super()._validate_missing(value)
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
```

</details>

<details><summary>reply</summary>

Done. `Constant` now accepts `required=True` and always loads the constant (`src/marshmallow/fields.py`). `load({})` and `load({"foo": 99})` both give `{"foo": 42}`, `Constant(None, required=True)` loads `None`, and `required` stays `True` on the field. Full test suite passes; I added no new tests and no changelog entry.

</details>

### claude, sloth: pass

Files: [CHANGELOG.rst](../sloth/claude/python-marshmallow-constant-required-1/files/CHANGELOG.rst), [src/marshmallow/fields.py](../sloth/claude/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py), [tests/test_deserialization.py](../sloth/claude/python-marshmallow-constant-required-1/files/tests/test_deserialization.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index 8b90369..14db878 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -8,6 +8,7 @@ Bug fixes:
 
 - Make `marshmallow.fields.Number` and `marshmallow.fields.Mapping` abstract base classes to
   prevent using them within Schemas (:issue:`2924`). Thanks :user:`MartingaleCoda` for reporting.
+- Fix ``fields.Constant(..., required=True)`` raising ``ValueError``.
 
 
 4.2.2 (2026-02-04)
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..0fc6bed 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,18 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
+        required = kwargs.pop("required", False)
         kwargs["load_default"] = constant
         kwargs["dump_default"] = constant
         super().__init__(**kwargs)
+        # Set after init: a required constant still loads as the constant when missing,
+        # ``required`` only marks the field as required for e.g. OpenAPI export.
+        self.required = required
         self.constant = constant
 
+    def _validate_missing(self, value) -> None:
+        """A missing value is always valid: it loads as the constant."""
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
 
diff --git a/tests/test_deserialization.py b/tests/test_deserialization.py
index 7cbe28e..2d8a61e 100644
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
+        assert MySchema._declared_fields["foo"].required is True
+        assert sch.load({}) == {"foo": 42, "bar": None}
+        assert sch.load({"foo": 99, "bar": 1}) == {"foo": 42, "bar": None}
+
     def test_constant_none_allows_none_value(self):
         class MySchema(Schema):
             foo = fields.Constant(None)
```

</details>

<details><summary>reply</summary>

Setting `required` alone isn't enough: `deserialize` would still raise "required" on a missing value. I'm overriding `_validate_missing` on `Constant` to skip that check, then adding the test.

`fields.Constant(42, required=True)` now defines without error. The full suite passes (1137 tests), including a new one for this case.

- **Cause:** `Constant` always passes `load_default=constant` to `Field.__init__`. The base class rejects `required=True` together with a `load_default`.
- **Fix, in `src/marshmallow/fields.py`:**
  - `Constant` now sets `required` after the base init, so the check no longer fires. `field.required` stays `True`, which is what your OpenAPI export reads.
  - It also overrides `_validate_missing` as a no-op. Without that, loading `{}` would have raised a "required" error.
- **Behavior:** `MySchema().load({})` and `MySchema().load({"foo": 99})` both return `{"foo": 42}`. `Constant(None, required=True)` loads as `None` in both cases, and a plain `Constant(None)` still works.
- **Test:** `test_required_constant_is_always_included_in_deserialized_data` in `tests/test_deserialization.py` covers the required constant and the required `None` constant.
- **Changelog:** I added a line to `CHANGELOG.rst`.

I had to set `PYTHONPATH=src` to run the tests, because `marshmallow` isn't installed in the environment. I haven't committed anything.

</details>

### claude, all: pass

Files: [src/marshmallow/fields.py](../all/claude/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py), [tests/test_deserialization.py](../all/claude/python-marshmallow-constant-required-1/files/tests/test_deserialization.py)

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
 
diff --git a/tests/test_deserialization.py b/tests/test_deserialization.py
index 7cbe28e..97faac5 100644
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
+        assert MySchema().fields["foo"].required
+        assert sch.load({}) == {"foo": 42, "bar": None}
+        assert sch.load({"foo": 99}) == {"foo": 42, "bar": None}
+
     def test_constant_none_allows_none_value(self):
         class MySchema(Schema):
             foo = fields.Constant(None)
```

</details>

<details><summary>reply</summary>

Tests failed to import marshmallow. Retrying with `PYTHONPATH=src`.

Done. `Constant` now pops `required`, sets it after init, and skips the missing-value check in `_validate_missing`. `required=True` is kept for OpenAPI. Added a test in `tests/test_deserialization.py`; the full suite passes (1137 tests).

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
index 8b90369..3deb43d 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -6,6 +6,9 @@ Changelog
 
 Bug fixes:
 
+- Restore support for ``fields.Constant(required=True)``, including loading
+  the constant when the field is missing.
+
 - Make `marshmallow.fields.Number` and `marshmallow.fields.Mapping` abstract base classes to
   prevent using them within Schemas (:issue:`2924`). Thanks :user:`MartingaleCoda` for reporting.
 
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..0d2be14 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,18 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
-        kwargs["load_default"] = constant
-        kwargs["dump_default"] = constant
+        kwargs["load_default"] = missing_
+        if kwargs.get("allow_none") is None:
+            kwargs["allow_none"] = constant is None
         super().__init__(**kwargs)
+        self.load_default = self.dump_default = constant
         self.constant = constant
 
+    def _validate_missing(self, value: typing.Any) -> None:
+        # Constants supply their own value even when required and missing.
+        if value is not missing_:
+            super()._validate_missing(value)
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
 
diff --git a/tests/test_deserialization.py b/tests/test_deserialization.py
index 7cbe28e..00fd384 100644
--- a/tests/test_deserialization.py
+++ b/tests/test_deserialization.py
@@ -1405,17 +1405,20 @@ class TestFieldDeserialization:
         field = fields.Constant("something")
         assert field.deserialize("whatever") == "something"
 
-    def test_constant_is_always_included_in_deserialized_data(self):
+    @pytest.mark.parametrize("required", [False, True])
+    def test_constant_is_always_included_in_deserialized_data(self, required):
         class MySchema(Schema):
-            foo = fields.Constant(42)
+            foo = fields.Constant(42, required=required)
 
         sch = MySchema()
+        assert sch.fields["foo"].required is required
         assert sch.load({})["foo"] == 42
         assert sch.load({"foo": 24})["foo"] == 42
 
-    def test_constant_none_allows_none_value(self):
+    @pytest.mark.parametrize("required", [False, True])
+    def test_constant_none_allows_none_value(self, required):
         class MySchema(Schema):
-            foo = fields.Constant(None)
+            foo = fields.Constant(None, required=required)
 
         sch = MySchema()
         assert sch.load({"foo": None})["foo"] is None
```

</details>

<details><summary>reply</summary>

I’ll check how `Constant` sets its defaults, fix the regression, and test the requested loading behavior, including `Constant(None)`.

Fixed `Constant(required=True)` so missing input loads the constant and supplied values are replaced with it. The field retains `required=True` for schema export, and `Constant(None)` continues to work.

Added regression coverage and a changelog entry. All 1,138 tests pass.

</details>

### codex, hush: pass

Files: [CHANGELOG.rst](../hush/codex/python-marshmallow-constant-required-1/files/CHANGELOG.rst), [src/marshmallow/fields.py](../hush/codex/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py), [tests/test_deserialization.py](../hush/codex/python-marshmallow-constant-required-1/files/tests/test_deserialization.py)

<details><summary>diff</summary>

```diff
diff --git a/CHANGELOG.rst b/CHANGELOG.rst
index 8b90369..2a9aa52 100644
--- a/CHANGELOG.rst
+++ b/CHANGELOG.rst
@@ -6,6 +6,9 @@ Changelog
 
 Bug fixes:
 
+- Allow ``fields.Constant`` with ``required=True`` while still supplying the constant
+  when input is missing.
+
 - Make `marshmallow.fields.Number` and `marshmallow.fields.Mapping` abstract base classes to
   prevent using them within Schemas (:issue:`2924`). Thanks :user:`MartingaleCoda` for reporting.
 
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..e9e9b04 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,18 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
-        kwargs["load_default"] = constant
+        kwargs.pop("load_default", None)
         kwargs["dump_default"] = constant
+        if kwargs.get("allow_none") is None:
+            kwargs["allow_none"] = constant is None
         super().__init__(**kwargs)
+        self.load_default = constant
         self.constant = constant
 
+    def _validate_missing(self, value: typing.Any) -> None:
+        if value is not missing_:
+            super()._validate_missing(value)
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
 
diff --git a/tests/test_deserialization.py b/tests/test_deserialization.py
index 7cbe28e..00fd384 100644
--- a/tests/test_deserialization.py
+++ b/tests/test_deserialization.py
@@ -1405,17 +1405,20 @@ class TestFieldDeserialization:
         field = fields.Constant("something")
         assert field.deserialize("whatever") == "something"
 
-    def test_constant_is_always_included_in_deserialized_data(self):
+    @pytest.mark.parametrize("required", [False, True])
+    def test_constant_is_always_included_in_deserialized_data(self, required):
         class MySchema(Schema):
-            foo = fields.Constant(42)
+            foo = fields.Constant(42, required=required)
 
         sch = MySchema()
+        assert sch.fields["foo"].required is required
         assert sch.load({})["foo"] == 42
         assert sch.load({"foo": 24})["foo"] == 42
 
-    def test_constant_none_allows_none_value(self):
+    @pytest.mark.parametrize("required", [False, True])
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
`Constant(required=True)` accepts missing input, returns constant, preserves required flag. `Constant(None)` works. Regression tests added; 1,138 tests passed.

</details>

### codex, sloth: pass

Files: [src/marshmallow/fields.py](../sloth/codex/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py), [tests/test_deserialization.py](../sloth/codex/python-marshmallow-constant-required-1/files/tests/test_deserialization.py)

<details><summary>diff</summary>

```diff
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..cd7ee86 100644
--- a/src/marshmallow/fields.py
+++ b/src/marshmallow/fields.py
@@ -2074,11 +2074,18 @@ class Constant(Field[_ContantT]):
     _CHECK_ATTRIBUTE = False
 
     def __init__(self, constant: _ContantT, **kwargs: Unpack[_BaseFieldKwargs]):
+        required = kwargs.pop("required", False)
         kwargs["load_default"] = constant
         kwargs["dump_default"] = constant
         super().__init__(**kwargs)
+        self.required = required
         self.constant = constant
 
+    def _validate_missing(self, value: typing.Any) -> None:
+        """Allow missing values to resolve to the constant, even when required."""
+        if value is not missing_:
+            super()._validate_missing(value)
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
 
diff --git a/tests/test_deserialization.py b/tests/test_deserialization.py
index 7cbe28e..bbb4f40 100644
--- a/tests/test_deserialization.py
+++ b/tests/test_deserialization.py
@@ -1405,13 +1405,17 @@ class TestFieldDeserialization:
         field = fields.Constant("something")
         assert field.deserialize("whatever") == "something"
 
-    def test_constant_is_always_included_in_deserialized_data(self):
+    @pytest.mark.parametrize("required", [False, True])
+    @pytest.mark.parametrize("constant", [42, None])
+    def test_constant_is_always_included_in_deserialized_data(self, required, constant):
+        """Constants resolve missing and supplied values regardless of required."""
         class MySchema(Schema):
-            foo = fields.Constant(42)
+            foo = fields.Constant(constant, required=required)
 
         sch = MySchema()
-        assert sch.load({})["foo"] == 42
-        assert sch.load({"foo": 24})["foo"] == 42
+        assert sch.fields["foo"].required is required
+        assert sch.load({}) == {"foo": constant}
+        assert sch.load({"foo": 99}) == {"foo": constant}
 
     def test_constant_none_allows_none_value(self):
         class MySchema(Schema):
```

</details>

<details><summary>reply</summary>

I’ll check how `Constant` sets its defaults and how missing values are loaded, then add a focused regression test and run the tests.

The conflict is in `Constant`: it supplies a load default, which the base field rejects with `required=True`. Loading also checks whether a required value is missing before applying that default.

I’ll handle both in `Constant`, preserving its `required` flag and the existing validation rules for other fields. The change reaches the field implementation and its deserialization tests; no callers, fixtures, configuration, or exports need changes.

Fixed `Constant(required=True)` to preserve the required flag and return the constant for both missing and supplied values. `Constant(None)` continues to work.

Added regression coverage for required and optional constants, including `None`. All 1,139 tests pass, and the wheel builds successfully.

</details>

### codex, all: pass

Files: [src/marshmallow/fields.py](../all/codex/python-marshmallow-constant-required-1/files/src/marshmallow/fields.py), [tests/test_deserialization.py](../all/codex/python-marshmallow-constant-required-1/files/tests/test_deserialization.py)

<details><summary>diff</summary>

```diff
diff --git a/src/marshmallow/fields.py b/src/marshmallow/fields.py
index 5b8a072..46d4694 100644
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
+        """Allow missing input, which is replaced by the constant."""
+        if value is not missing_:
+            super()._validate_missing(value)
+
     def _serialize(self, value, *args, **kwargs) -> _ContantT:
         return self.constant
 
diff --git a/tests/test_deserialization.py b/tests/test_deserialization.py
index 7cbe28e..2d1e73d 100644
--- a/tests/test_deserialization.py
+++ b/tests/test_deserialization.py
@@ -1405,13 +1405,17 @@ class TestFieldDeserialization:
         field = fields.Constant("something")
         assert field.deserialize("whatever") == "something"
 
-    def test_constant_is_always_included_in_deserialized_data(self):
+    @pytest.mark.parametrize("required", [False, True])
+    @pytest.mark.parametrize("constant", [42, None])
+    def test_constant_is_always_included_in_deserialized_data(self, required, constant):
+        """Constants load whether required, absent, or replaced by other input."""
         class MySchema(Schema):
-            foo = fields.Constant(42)
+            foo = fields.Constant(constant, required=required)
 
         sch = MySchema()
-        assert sch.load({})["foo"] == 42
-        assert sch.load({"foo": 24})["foo"] == 42
+        assert sch.fields["foo"].required is required
+        assert sch.load({}) == {"foo": constant}
+        assert sch.load({"foo": 99}) == {"foo": constant}
 
     def test_constant_none_allows_none_value(self):
         class MySchema(Schema):
```

</details>

<details><summary>reply</summary>

Done.
Required `Constant` accepts missing input and preserves `None`. Added regression coverage; 1,139 tests passed. Wheel built.

</details>
