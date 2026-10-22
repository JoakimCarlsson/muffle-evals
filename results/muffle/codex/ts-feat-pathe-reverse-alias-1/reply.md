I’ll check the existing alias handling, add the reverse helper, and test the boundary and trailing-slash cases.

Added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, exported through `pathe/utils`.

It normalizes aliases and Windows paths, respects target boundaries and trailing slashes, and returns matches longest first.

Validation passed: 368 tests, lint, type checking, and build.
