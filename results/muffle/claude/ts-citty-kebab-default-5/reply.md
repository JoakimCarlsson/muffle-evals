`--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. With no flag, `fooBar` is still `"two"`. The full suite passes with the new test (64 tests).

**Cause:** `parseRawArgs` in `src/_parser.ts` passed defaults to Node's `parseArgs`, so `fooBar` was already `"two"` when the parse finished. The kebab-case flag landed in `foo-bar`. The step that copies values between aliases only fills in names that are still undefined, so it never overwrote the default.

**Fix:** In `src/_parser.ts`, defaults are no longer given to Node's `parseArgs`. They are applied after the alias values have been copied across, and only to names that are still undefined. The aliases are then synced a second time so default values show up under every name.

I added a regression test for your exact case in `test/args.test.ts`. I haven't committed anything.
