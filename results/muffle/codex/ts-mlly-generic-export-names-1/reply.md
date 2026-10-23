I’ll check how declaration separators are parsed, fix the generic argument handling, and add regression tests for these cases.

The scanner tracks angle brackets only in type annotations, so it treats commas in generic calls as declaration separators. It also treats the `>` in `=>` as a closing angle bracket. I’ll fix both and use a lookahead for generic calls so `1<2` still parses correctly.

Fixed `findExports` to handle commas inside generic constructor and function calls, preserve comparison expressions, and correctly handle `=>` inside generic type annotations.

Added regression tests for your examples, nested generics, and `findExportNames`.

Validation passed: all 197 tests, TypeScript checks, lint, and formatting.
