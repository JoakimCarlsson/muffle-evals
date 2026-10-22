I’ll check the parser and existing tests, add the error handling, and run the relevant tests.

Fixed the panic in both borrowed and owned strftime parsers. Trailing `%_`, `%-`, and `%0` now return `InvalidFormatDescription::Expected` with `"valid escape sequence"` at the missing component’s byte index.

Added regression coverage for prefixes, UTF-8 byte positions, and valid padding modifiers. All 53 strftime tests pass.

Formatting checks found only existing issues in unrelated files.
