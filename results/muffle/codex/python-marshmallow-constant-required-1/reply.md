I’ll check how `Constant` sets its defaults, fix the regression, and test the requested loading behavior, including `Constant(None)`.

Fixed `Constant(required=True)` so missing input loads the constant and supplied values are replaced with it. The field retains `required=True` for schema export, and `Constant(None)` continues to work.

Added regression coverage and a changelog entry. All 1,138 tests pass.
