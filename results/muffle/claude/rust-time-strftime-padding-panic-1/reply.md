I've fixed the panic in the tokenizer and am adding a regression test next.

`parse_strftime_borrowed` (and `parse_strftime_owned`) now return an error for `"%_"`, `"%-"` and `"%0"` instead of panicking. The strftime tests pass, including the new ones. I only ran the strftime tests, not the whole suite, and I didn't run your `poc_strftime_oob_panic` example.

The tokenizer read the byte after the padding modifier without checking it existed. It now checks, and when the component is missing it returns the same `Expected { what: "valid escape sequence" }` error as other malformed escapes. The error index is the position where the component should have been, so 2 for `"%_"`. The fix is in `time/src/format_description/parse/strftime.rs`.

I added `strftime_missing_component_error` to `time/tests/integration/parse_format_description.rs`. It covers `%_`, `%-`, `%0`, `a%_` and a bare `%`. A bare `%` already returned an error, and its index is still 0.

I haven't committed anything.
