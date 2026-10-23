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
