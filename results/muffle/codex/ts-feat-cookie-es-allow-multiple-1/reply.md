I’ll check the parser and its types, add `allowMultiple`, and test that the default behavior stays unchanged.


The parser now collects duplicate values in order, and the return type reflects `allowMultiple`. I’ve added tests for empty values, decoding, filters, and types. Validation found a formatting issue in the unchanged serializer test; I’m continuing with the tests, type check, and build.


Added `allowMultiple` with inferred return types, documentation, and tests. Duplicate values become arrays in order; single values remain strings. Default behavior is unchanged.

All 103 tests pass, lint passes, and the build succeeds. Full formatting and type checks encounter existing issues in unrelated tests and TypeScript configuration; changed files pass formatting.
