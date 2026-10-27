I’ll inspect Lark’s lexer and LALR parser, add scanning and standalone support, then run focused tests for the requested behavior.

Scanning now recognizes candidate token sequences, then builds the result from the longest accepted sequence. This avoids copying transformer values and preserves source positions through `TextSlice`. Standalone generation also works in a smoke test; I’m checking ignored text, callbacks, nullable rules, and lexer behavior next.

The focused tests pass, including standalone scanning, callback rejection, missing token positions, and transformer values that cannot be copied. The broader run found three test setup/import errors. I’ll rerun the runtime tests using the repository’s test entry point.

Implemented `Lark.scan()` and exported generic, value-comparable `ScanMatch`.

Includes standalone support, absolute source positions, callback handling, nullable-rule protection, and token copy/pickle fixes.

Validation: `python -m tests` passed all 1,284 tests, with 134 skipped.
