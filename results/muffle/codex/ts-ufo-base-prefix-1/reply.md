I’ll check how both helpers match the base, add regression coverage, and fix the path boundary check.

The regression tests reproduce the prefix bug with both `/admin` and `/admin/`. I’ll make both helpers require the base to end at the end of the input or before `/`, `?`, or `#`.

Fixed both helpers to match complete path segments, preserving query and hash suffixes.

- `withoutBase('/admin-dashboard', '/admin/')` returns `/admin-dashboard`.
- `withBase('/admin-dashboard', '/admin/')` returns `/admin/admin-dashboard`.

Added regression coverage for both base formats and valid matches. All 497 tests, type checks, lint, and formatting checks pass.
