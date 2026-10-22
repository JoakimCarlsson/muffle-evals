Done. `Constant` in `src/marshmallow/fields.py` now accepts `required=True`, and `load({})` and `load({"foo": 99})` both give `{"foo": 42}`. `Constant(None)` still works. The 1136 existing tests pass, but I added no new test for the required case.

- **How:** it sets `required` after `super().__init__`, so the "load_default must not be set" check is skipped, and it overrides `_validate_missing` to do nothing.
- **Side effect:** `load({"foo": None})` now also gives `42` rather than a "may not be null" error. Say if you'd rather keep the null error.
