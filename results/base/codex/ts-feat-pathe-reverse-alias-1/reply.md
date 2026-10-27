I’ll check the existing alias handling, add the reverse helper, and test the matching and sorting behavior.

Added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`.

It normalizes aliases and Windows paths, matches target boundaries, preserves trailing-slash aliases, and sorts results longest first.

Validation passed: all 368 tests, lint, formatting, type checks, and build.
