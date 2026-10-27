Let me see how the parser handles defaults and aliases.

Node's `parseArgs` applies the default to `fooBar`, so the propagation step sees it as already set and never copies `foo-bar`'s value over. I'll apply defaults after alias propagation instead.

`--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. The full suite passes (64 tests) and `tsc` reports no errors.

**Cause:** `src/_parser.ts` passed defaults to Node's `parseArgs`, so `fooBar` was pre-filled with `"two"` while only `foo-bar` received `"one"`. The alias-propagation step only copies a value when the target is undefined, so it never overwrote the default.

**Fix:** In `src/_parser.ts`, I removed the `default` option from the Node `parseArgs` call. Defaults are now applied at the end, after alias propagation, to any name still undefined, and mirrored to its aliases. So a value passed under any spelling beats the default, and with no input you still get `"two"` for both `fooBar` and `foo-bar`.

I added `test/kebab-default.test.ts`, which covers both the override case and the default case. I haven't committed anything.
