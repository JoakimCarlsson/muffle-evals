I’ll check the base-matching logic, add regression tests for the prefix collision, and run the relevant checks.

Fixed both functions to require a boundary after the base: end of input, `/`, `?`, or `#`.

`/admin-dashboard` now stays unchanged with `withoutBase` and becomes `/admin/admin-dashboard` with `withBase`. Existing base-path behavior is preserved.

Added regression coverage. All 495 tests, type checks, lint, and formatting passed.
