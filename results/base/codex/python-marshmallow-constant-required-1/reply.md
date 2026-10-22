I’ll check how `Constant` handles defaults, fix the regression, and add tests for the loading behavior you described.

`Constant` now passes its value as `load_default` during initialization, which conflicts with `required=True`. I’ll set its defaults after initialization and let missing input use the constant, while preserving `Constant(None)` behavior.

Fixed `fields.Constant(..., required=True)`. Missing input now loads the constant, and supplied values are replaced with it. `Constant(None)` still works, and `required=True` remains available for schema export.

Added regression coverage and a changelog entry. All 1,138 tests pass.
