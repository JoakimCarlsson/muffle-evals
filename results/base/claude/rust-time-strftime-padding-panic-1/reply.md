Let me add a test.

`parse_strftime_borrowed` no longer panics on `"%_"`, `"%-"` or `"%0"`. It now returns the same `Expected { what: "valid escape sequence", .. }` error that the bare `"%"` case already gave. The new and existing strftime tests pass; I didn't run the rest of the suite or your `poc_strftime_oob_panic` example (there is no `examples` directory in the repo).

The panic came from the tokenizer indexing `input[2]` without checking that a byte followed the padding modifier. The fix is in `time/src/format_description/parse/strftime.rs`. It now uses `get(2)` and reports the error at the byte offset where the component should have been, which is `%` position + 2. A bare trailing `%` still reports the position of the `%`.

I added a test, `strftime_missing_component_error`, in `time/tests/integration/parse_format_description.rs`. It covers `"%"`, `"%_"`, `"%-"`, `"%0"` and `"a%0"`, through both the borrowed and owned parsers, and checks the reported index.

I haven't committed anything.
