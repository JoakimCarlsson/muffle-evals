I’ll check the existing alias behavior, add the reverse utility, and run focused tests.

Added `reverseResolveAlias` to `src/utils.ts`, with alias normalization, Windows path support, separator-boundary matching, trailing-slash handling, and longest-first results.

Added regression tests. All 367 tests, TypeScript checks, ESLint, and formatting checks pass.
