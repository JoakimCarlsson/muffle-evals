I’ll check how `findExports` splits declarations, fix generic argument handling, and add regression tests for the cases you listed.

The scanner already tracks generic brackets in type annotations, but not in initializers. It also treats the `>` in `=>` as a closing generic bracket. I’ll fix both and use lookahead to distinguish generic calls from comparisons such as `1<2`.

Fixed `findExports` to recognize generic constructor and call arguments while preserving real comparison separators. Arrow function types no longer close generic brackets prematurely.

Added regression tests for your examples and nested generics.

Validation passed: all 195 tests, lint, formatting, and TypeScript checks.
