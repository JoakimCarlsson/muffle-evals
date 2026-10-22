I’ll check the base-path matching logic, add regression coverage, and run the tests.

Fixed both functions to match the base only at a path boundary: end of input, `/`, `?`, or `#`.

Added regression tests for prefix collisions and valid base paths, with and without trailing slashes.

Validation passed: all 497 tests, type checking, ESLint, and formatting.
