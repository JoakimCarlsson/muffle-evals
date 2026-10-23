Fix is in; now I'll verify it and run the tests.

`fields.Constant(42, required=True)` is accepted again. I haven't added a regression test for it.

- `MySchema().load({})` and `MySchema().load({"foo": 99})` both give `{"foo": 42}`.
- `Constant(None, required=True)` loads `{"foo": None}`.
- The field still reports `required=True`, so your OpenAPI export still marks it required.
- The existing suite passes (1136 tests).

**Cause:** `Constant` always passes `load_default=constant` to the base `Field`. The latest release added a check that rejects `load_default` on required fields, so `required=True` now raises.

**Fix:** `Constant.__init__` in `src/marshmallow/fields.py` now takes `required` out of the arguments and sets it on the field after the base class is initialised. `Constant` also overrides `_validate_missing` so a missing value never raises the "required" error. I added a bug-fix line to `CHANGELOG.rst`.

I didn't commit anything.
