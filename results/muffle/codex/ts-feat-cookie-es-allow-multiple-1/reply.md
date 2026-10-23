I’ll check the parser, types, and tests, then add `allowMultiple` while preserving the default first-value behavior.

The option is implemented, and all 103 tests pass, including duplicate ordering, empty values, decoding, and filtering. The type check hit an existing TypeScript 6 configuration deprecation; I’ll suppress that diagnostic for verification, then finish the build check.

Added `allowMultiple` with inferred return types and documentation.

- Duplicate values become arrays in header order; single values stay strings.
- Empty values and decoding behavior are preserved.
- Default behavior remains first value wins.

All 103 tests and the build pass. Full type checking remains blocked by existing configuration and unrelated test errors.
