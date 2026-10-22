I’ll check how `resolveAlias` handles normalization, add the reverse helper alongside it, and run the relevant tests.

Added `reverseResolveAlias(path, aliases): string[]` to `src/utils.ts`, exported through `pathe/utils`.

It normalizes aliases and Windows paths, matches target boundaries, preserves trailing-slash aliases, and sorts results longest first.

All 368 tests pass, along with lint, formatting, type checks, and build.
