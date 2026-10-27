I’ll check the alias handling and existing tests, add the reverse helper, then run the build and relevant tests.

The helper now uses `normalizeAliases`, normalizes Windows paths, and sorts the resulting strings by length. I’m adding tests for all five examples, separator boundaries, and normalized alias targets.

Added `reverseResolveAlias` to `src/utils.ts` with normalization, boundary matching, trailing-slash support, and longest-first sorting.

All five examples and edge cases pass. Build, lint, formatting, 369 tests, and type checks passed using local binaries; `pnpm` was unavailable.

No extra options or dependencies added.
