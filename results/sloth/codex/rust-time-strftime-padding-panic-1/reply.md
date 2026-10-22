I’ll check the shared strftime parser and its callers, fix the bounds check, then build and run the existing tests.

All three padding branches index the missing component byte without checking its length. The fix belongs in the shared tokenizer, which also covers `parse_strftime_owned`. No caller, export, fixture, or configuration changes are needed. I’ll preserve valid-format behavior and return the existing “valid escape sequence” error at the missing byte’s position.

Fixed the shared tokenizer to check for a component before indexing it. Both borrowed and owned parsers now return `Expected { what: "valid escape sequence", index: 2 }` for `"%_"`, `"%-"`, and `"%0"`.

Verified the reproduction, byte offsets after prefixes, and valid padded formats. Build and existing tests with `--all-features` passed.
