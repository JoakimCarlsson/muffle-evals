Fixed: `--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. The full suite passes, including a new regression test.

**Cause:** `parseRawArgs` in `src/_parser.ts` passed the defaults to `node:util`'s `parseArgs`. With a default set, `fooBar` was already `"two"` when alias propagation ran. The value passed as `foo-bar` was never copied across, because propagation only fills in values that are `undefined`.

**Fix:** In `src/_parser.ts`, the defaults are no longer passed to `parseArgs`. Aliases are propagated first, then defaults are applied to anything still unset, then aliases are propagated once more. An explicit value passed under any alias name now beats the default.

**Test:** The new test is `test/_kebab.test.ts`. It covers the kebab-case override and the case where no flag is passed, which still gives the default.
