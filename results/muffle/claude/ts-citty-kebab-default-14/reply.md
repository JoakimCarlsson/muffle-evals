Fixed in `src/_parser.ts`. `--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. With no flag, both keys are `"two"`. The existing 63 tests pass. I didn't add a regression test for this case.

**Cause:** defaults were passed into Node's `parseArgs`. That pre-filled `fooBar: "two"`, and the later alias step only copies a value to the main name when the main name is still undefined. So the `"foo-bar": "one"` you passed lost to the default.

**Fix:** defaults are no longer given to `parseArgs`. They are applied after the aliases are resolved, and only to names that are still undefined. The alias copy then runs a second time so the default reaches the other spellings (camelCase and kebab-case) too.
