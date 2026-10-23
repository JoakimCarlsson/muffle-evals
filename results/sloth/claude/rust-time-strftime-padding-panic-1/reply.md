Now the fix and test.

Use pattern matching like the existing tests.

`parse_strftime_borrowed("%_")`, `"%-"` and `"%0"` now return an error instead of panicking. It is the same "valid escape sequence" expected-error that a truncated `"%"` already gave. Its index is the position where the component is missing, so 2 for each of your three inputs. The strftime tests pass (46), but I didn't run the rest of the suite or your `poc_strftime_oob_panic` example.

The fix is in `time/src/format_description/parse/strftime.rs`. The tokenizer now reads the component byte with `get` and returns the error when it is absent. Previously it indexed `self.input[2]` directly after a padding modifier. `parse_strftime_owned` goes through the borrowed parser, so it is fixed too.

I added a `strftime_missing_component` test to `time/tests/integration/parse_format_description.rs`. It covers `%`, `%_`, `%-`, `%0` and `a%_` (index 3 after a literal), for both the borrowed and owned parsers.

The integration tests need `--all-features`, e.g. `cargo test -p time --all-features --test tests strftime`.
