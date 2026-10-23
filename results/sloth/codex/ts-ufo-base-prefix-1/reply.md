I’ll check both helpers and their callers, add a regression test for the path boundary, then run the tests and build.

The change is limited to the two helpers in `src/utils.ts` and the existing base tests. There are no internal callers or signatures to update. I’ll require the prefix to end at the path’s end, `/`, `?`, or `#`, preserving query and fragment handling. No new API or dependency is needed.

Fixed both helpers to require a boundary after the base: end of input, `/`, `?`, or `#`.

Your examples now return the expected results. Regression coverage includes partial prefixes, actual child paths, queries, and fragments, with and without trailing slashes on the base.

Validation passed: lint, all 480 tests, type checks, and build.
