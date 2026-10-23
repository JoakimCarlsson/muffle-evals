I’ll check the alias helpers, exports, and tests, then add the reverse resolver and run the build and test suite.

The change needs to reach `src/utils.ts` and the existing utility tests. The package already exports everything from that file through `pathe/utils`, so no export or config changes are needed. I’ll reuse `normalizeAliases`, normalize Windows paths and targets, and sort the results by string length. Existing resolver behavior will stay unchanged.

Added `reverseResolveAlias(path, aliases): string[]` to `pathe/utils`, with alias normalization, Windows path handling, boundary matching, trailing-slash support, and longest-first sorting.

Validation passed: 363 tests, lint, formatting, TypeScript checks, and build.
