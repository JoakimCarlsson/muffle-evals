I’ll check alias normalization and exports, add the helper beside `resolveAlias`, then run the build and existing tests.

This only needs a change in `src/utils.ts`: the existing exports will expose the helper and its types. I’ll reuse `normalizeAliases`, normalize Windows paths on both sides, preserve aliases ending in `/`, and sort results by string length. No new options or dependencies are needed.

Added `reverseResolveAlias(path, aliases): string[]` in `src/utils.ts`, exported through `pathe/utils`.

It reuses alias normalization, handles Windows paths and trailing slashes, matches separator boundaries, and sorts results longest first.

Build, lint, type checks, all 362 existing tests, and direct checks of your examples passed.
