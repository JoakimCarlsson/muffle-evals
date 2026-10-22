Let me see how the parser handles defaults and aliases.

`--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. The full suite passes (64 tests), including a new regression test.

**Cause:** `src/_parser.ts` handed the defaults to `node:util`'s `parseArgs`, which applied `fooBar: "two"` up front. The CLI value landed on the `foo-bar` alias. When the parser copied values between aliases, it saw `fooBar` already set and never overwrote it with `"one"`.

**Fix:** Defaults are no longer passed to `node:util`. The parser copies values between aliases first, then fills in any option still undefined with its default, then copies between aliases once more. A value passed under any spelling therefore takes priority over the default.

I added the regression test in `test/_kebab.test.ts`. It checks `--foo-bar one` against the `fooBar` enum from your report, and that with no flag the default `"two"` still applies.

I haven't committed anything.
