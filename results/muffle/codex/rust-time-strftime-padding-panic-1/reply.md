I’ll check how the parser handles padding modifiers, add a regression test, and make the malformed inputs return an error.

The parser now checks for a component after the padding modifier and returns `Expected { what: "valid escape sequence", index: 2 }` for each reported input. Regression tests cover both parsing APIs, byte offsets after prefixes, and valid padded formats. The focused test run is still running.

Fixed both borrowed and owned strftime parsers. `"%_"`, `"%-"`, and `"%0"` now return `InvalidFormatDescription::Expected` with `"valid escape sequence"` at byte index 2 instead of panicking.

Added regression coverage for all three modifiers, prefixed inputs, Unicode byte offsets, and valid padding.

Validation: all 53 strftime tests passed; `git diff --check` passed.
