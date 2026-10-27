I’ll check how `resolveAlias` handles normalization, add the reverse helper, and test the matching edge cases.

The helper and tests are in place. They cover the examples, alias normalization, Windows paths, and separator boundaries. `pnpm` isn’t available here, so I’ll run the checks using the installed local tools.

Added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`.

It normalizes aliases and Windows paths, matches targets at path boundaries, preserves trailing alias slashes, and sorts results longest first.

All 367 tests pass, along with lint, type checks, and build.
