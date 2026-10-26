Fixed: `--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`, and with no flag `fooBar` still falls back to `"two"`. The full test suite passes (64 tests).

**Cause:** `parseRawArgs` in `src/_parser.ts` passed defaults to Node's `parseArgs` under the camelCase name. Your `--foo-bar one` was stored under `foo-bar`, but `fooBar` was already holding the default. The step that copies values between aliases only fills in names that are unset, so it never overwrote the default.

**Fix:** Defaults are no longer handed to `parseArgs`. They're applied afterwards, and only when neither the option nor any of its aliases was set. The existing alias step then copies the value to every name.

I added a regression test in `test/kebab-default.test.ts`. It covers the kebab-case override and the default when no flag is passed.
