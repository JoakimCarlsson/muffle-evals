Fixed: `--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. The full suite passes (64 tests), including a new regression test.

The default was handed to `node:util`'s `parseArgs` as a default on `fooBar`, so `fooBar` always had a value. The alias-propagation step only copies a value to an alias that is still undefined. The `"one"` that landed on `foo-bar` therefore never replaced `fooBar`'s default `"two"`.

In `src/_parser.ts`, defaults are no longer passed to `node:util`. They are applied after parsing and alias propagation, only to keys that are still undefined, and then propagated once more so every alias gets the default. A value passed under any alias form now wins over the default.

The regression test is `test/kebab-default.test.ts`. It also checks that the default `"two"` still applies when no flag is passed.

I haven't committed anything.
