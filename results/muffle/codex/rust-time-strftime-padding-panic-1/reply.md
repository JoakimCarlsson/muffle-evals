I’ll check the parser and existing tests, fix the bounds check, and add regression coverage for all three modifiers.

Fixed the bounds check. Trailing `%_`, `%-`, and `%0` now return `InvalidFormatDescription::Expected` for a valid escape sequence at the missing component’s byte position.

Added regression tests for borrowed and owned parsing, including prefixed and UTF-8 inputs. All format-description tests pass.

Formatting checks found only pre-existing issues in unrelated files.
