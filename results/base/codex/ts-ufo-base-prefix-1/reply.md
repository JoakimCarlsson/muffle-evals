I’ll check the base-path matching logic and tests, then update it to respect path boundaries.

Fixed both functions to require a boundary after the base: end of input, `/`, `?`, or `#`.

`/admin-dashboard` now stays unchanged with `withoutBase` and becomes `/admin/admin-dashboard` with `withBase`. Existing base paths, queries, and fragments still work.

Added regression coverage for bases with and without trailing slashes. All 497 tests, type checks, lint, and formatting checks pass.
