I’ll check the base-matching logic, fix the path boundary check, and add regression tests for these cases.

Fixed both functions to require a boundary after the base: end of input, `/`, `?`, or `#`.

Added regression coverage for prefix collisions, trailing slashes, queries, and fragments. Your `/admin-dashboard` examples now return the expected results.

Validation passed: lint, formatting, all 507 tests, and type checking.
