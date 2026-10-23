I’ll check how `Constant` sets its defaults and how missing values are loaded, then add a focused regression test and run the tests.

The conflict is in `Constant`: it supplies a load default, which the base field rejects with `required=True`. Loading also checks whether a required value is missing before applying that default.

I’ll handle both in `Constant`, preserving its `required` flag and the existing validation rules for other fields. The change reaches the field implementation and its deserialization tests; no callers, fixtures, configuration, or exports need changes.

Fixed `Constant(required=True)` to preserve the required flag and return the constant for both missing and supplied values. `Constant(None)` continues to work.

Added regression coverage for required and optional constants, including `None`. All 1,139 tests pass, and the wheel builds successfully.
