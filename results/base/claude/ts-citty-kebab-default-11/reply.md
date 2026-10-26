Fixed: `--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. The full test suite passes, including a new test for this case.

**Cause:** in `src/_parser.ts`, the default was handed to Node's `parseArgs`, so `fooBar` was already `"two"` before alias propagation ran. The propagation step only copies a value to the main name when that name is still `undefined`, so the `"foo-bar"` value never overwrote the default.

**Fix:** defaults are no longer passed to Node's `parseArgs`. They are applied after alias propagation, only to names that are still unset, and then propagated to the aliases again. A value given through any alias (kebab-case, camelCase or short) now wins, and with no CLI input both `fooBar` and `"foo-bar"` carry the default.

The regression test is `test/kebab-default.test.ts`. It checks both the `--foo-bar one` case and the no-input default case. I haven't committed anything.
