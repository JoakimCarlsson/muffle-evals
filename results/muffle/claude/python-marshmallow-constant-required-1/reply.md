`fields.Constant(42, required=True)` now works again. Both `MySchema().load({})` and `MySchema().load({"foo": 99})` give `{"foo": 42}`. The full test suite passes (1137 tests), including a new one.

The fix is in `Constant.__init__` in `src/marshmallow/fields.py`. `Constant` always sets `load_default` to the constant, and a recent change makes the base `Field` reject `load_default` together with `required=True`. `Constant` now takes `required` out of its arguments before calling the base constructor and sets it afterwards. Its `_validate_missing` override skips the "missing required field" error, so the constant is loaded instead. The field still reports `required=True`, so the OpenAPI export marks it as required.

`Constant(None)` still works, including with `required=True`.

I added `test_required_constant_is_always_included_in_deserialized_data` to `tests/test_deserialization.py`. It covers `Constant(42)` and `Constant(None)`, each with `required=True`. I also added a bug-fix entry to `CHANGELOG.rst`. Nothing is committed.
