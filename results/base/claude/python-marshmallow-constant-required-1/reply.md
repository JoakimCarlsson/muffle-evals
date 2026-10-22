Edit applied; the package isn't installed, so I'm re-running the check with `PYTHONPATH=src`.

Now a test and changelog entry.

`fields.Constant(42, required=True)` now defines without error and is still reported as required, so your OpenAPI export keeps working. The full test suite passes, including the new tests.

- **Loading:** `MySchema().load({})` and `MySchema().load({"foo": 99})` both give `{"foo": 42}`.
- **`Constant(None)`:** `fields.Constant(None, required=True)` loads `{"foo": None}`, and the default `Constant(None)` behaves as before.
- **Cause:** `Constant` always sets a `load_default`, and the base `Field` rejects `required=True` together with one.
- **Fix:** `Constant` now keeps `required` out of the base-class check and sets it afterwards. It also overrides `_validate_missing` so a missing value yields the constant instead of a "required" error. The change is in `src/marshmallow/fields.py`.

I also added two tests in `tests/test_fields.py` and a bug-fix entry in `CHANGELOG.rst`. Nothing is committed.
