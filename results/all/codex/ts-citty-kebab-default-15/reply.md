Fix scope: argument normalization, default handling, and parser tests.


Cause: Node applied defaults before alias resolution. Defaults now fill missing values after aliases resolve; 70 tests pass.


Done.
Defaults now apply after alias resolution; kebab-case input overrides camelCase defaults. Added regression tests. All 71 tests, type checks, lint, formatting pass.
