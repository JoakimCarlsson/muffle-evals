Re-running my check with the `formatting` feature enabled.

`parse_strftime_borrowed` no longer panics on `"%_"`, `"%-"` or `"%0"`. It now returns the same error as `"%"` alone, `Expected { what: "valid escape sequence", index }`. The `index` is where the missing component should be, which is 2 for these three. Format strings with text in front of the `%` report the shifted position, so `"a%_"` gives index 3.

The fix is in `time/src/format_description/parse/strftime.rs`. The tokenizer now reads the component byte with `get` instead of indexing, so it can't run off the end. The error index for a bare `"%"` is unchanged at 0.

I ran the five inputs `"%_"`, `"%-"`, `"%0"`, `"%"` and `"a%_"` through a throwaway example, and they gave the errors above. `cargo test -p time --all-features` passed in the unit-test section that I looked at, but I cut the output short, so I didn't confirm that every suite finished. I did not add a regression test, since you didn't ask for one. I removed the throwaway example, and the only changed file is the one above.
