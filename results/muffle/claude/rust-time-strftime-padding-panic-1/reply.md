Running the tests again with the right target name (`tests`). Also checking the file's current state, since it changed on disk.

`parse_strftime_borrowed` and `parse_strftime_owned` no longer panic on a trailing `%_`, `%-` or `%0`. They now return the same "valid escape sequence" error that other malformed escapes give.

The strftime tests pass, including the new ones. I did not run the whole test suite, or the `poc_strftime_oob_panic` example from your report.

The tokenizer in `time/src/format_description/parse/strftime.rs` read the byte after the padding modifier with direct indexing. It now uses a checked lookup. If that byte is missing, the error index is the position where the component should have been, so `"%_"` gives index 2.

A bare `"%"` still reports index 0, as before.

I added a `strftime_missing_component` test in `time/tests/integration/parse_format_description.rs`. It covers `%`, `%_`, `%-`, `%0` and `a%_` (index 3).

I haven't committed anything.
