Fixed. `--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. With no flag, both keys are `"two"`. The full test suite passes, including a new regression test.

**Cause:** In `src/_parser.ts`, defaults were passed to `node:util`'s `parseArgs` under the camelCase name, so `fooBar` always held `"two"`. The `--foo-bar` value landed on the other key. The alias step only copies a value across when the target is undefined, and `fooBar` never was.

**Fix:**
- I removed the defaults from the `node:util` options.
- Defaults are now applied after alias propagation, and only where no value was given under any name. They are then copied to the aliases.

I added the regression test in `test/_kebab.test.ts`.

I haven't committed anything.
