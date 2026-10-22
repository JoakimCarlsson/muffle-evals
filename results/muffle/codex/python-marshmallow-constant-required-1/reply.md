I’ll check `Constant`’s initialization and load behavior, add regression coverage, and run the relevant tests.

`Constant` passes its value as a load default to the base field, which rejects defaults on required fields. I’ll give `Constant` its own deserialization path so it always returns the preset value, and keep the default validation rule for ordinary fields.

Fixed `Constant(required=True)` to preserve the required flag and always load the constant, including when input is missing or different. `Constant(None)` also works.

Added regression coverage and a changelog entry. All 1,139 tests pass.
