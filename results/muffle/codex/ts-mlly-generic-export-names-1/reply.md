I’ll check how `findExports` splits declarations, fix generic argument handling, and add regression tests for these cases.

The declaration regex also truncates some matches before the closing `>`, so the scanner needs to look past the captured text to recognize a generic call. I’ll add that lookahead while preserving comparison handling. Arrow function types also need a guard so `=>` doesn’t close a generic list.

Fixed `findExports` to ignore commas inside generic constructor and call arguments, preserve real declaration separators, and handle `=>` inside generic type annotations.

Added regression tests for all reported cases and nested generics.

Validation passed: all 198 tests, ESLint, Prettier, and TypeScript checks.
