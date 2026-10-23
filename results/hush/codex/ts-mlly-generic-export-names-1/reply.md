`findExports` needs generic-aware declaration splitting. Checking parser and tests.


Done.
`findExports` handles generic arguments, comparisons, arrow types, multiple declarations. Added regression tests. All 196 tests, lint, formatting, type checks pass.
