Passing `--foo-bar one` now overrides the default, so `fooBar` is `"one"` and `"foo-bar"` is `"one"`. With no flag, `fooBar` is still `"two"`. The full test suite passes (64 tests).

The cause was in `src/_parser.ts`. Defaults were handed to `node:util`'s `parseArgs`, so `fooBar` was already `"two"` before the aliases were merged. The merge only fills in a name that is `undefined`, so `"foo-bar": "one"` never replaced it.

Now defaults are applied after parsing and alias merging, and only to names that are still unset. Aliases are merged once more afterwards so the default shows up under every name.

I added a regression test in `test/kebab-default.test.ts`. I haven't committed anything.
