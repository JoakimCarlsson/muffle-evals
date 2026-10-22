I’ll check the parser and tests, add `allowMultiple` with matching return types, and verify that the default behavior stays unchanged.

The parser now collects duplicate values in order when `allowMultiple` is enabled. I’ve added tests for empty values, decoding, filtering, and return types. Since `pnpm` isn’t available here, I’m running the installed check tools directly.

Added `allowMultiple: true` with ordered arrays for duplicate names, strings for single values, and matching TypeScript return types. Default first-value behavior is unchanged.

All 101 tests pass; build and lint pass. Full formatting and type checks encounter existing issues in unrelated tests and TypeScript configuration.
