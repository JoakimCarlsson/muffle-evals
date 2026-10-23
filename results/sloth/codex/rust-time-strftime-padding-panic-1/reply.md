I’ll check how the parser handles padding modifiers and reports error positions, add a focused regression test, then build and run the tests.

Both public strftime parsers use the same tokenizer, so the fix belongs there. I’ll add a bounds check and tests for both APIs, including literal and multibyte prefixes to verify byte positions. No caller, export, fixture, or configuration changes are needed; the existing error position for a bare `%` will stay unchanged.

The build and all 5,029 integration tests passed, including the seven regression cases. Documentation tests are still running. The malformed padded escapes now return `Expected { what: "valid escape sequence", index: … }` at the missing component’s byte position.

Fixed the shared tokenizer so `"%_"`, `"%-"`, and `"%0"` return an `Expected` error for `"valid escape sequence"` at byte index 2 instead of panicking. Both borrowed and owned parsers are covered.

Added regression tests for all three modifiers and prefixed inputs, including UTF-8 byte positions.

Validation passed: formatting-feature build and all tests, including documentation tests.
