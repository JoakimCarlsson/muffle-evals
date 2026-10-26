Passing `--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. With no flag, `fooBar` still defaults to `"two"`. The full suite passes (64 tests), including a new regression test for your example.

The cause was that `parseRawArgs` in `src/_parser.ts` handed defaults to `node:util`'s `parseArgs`. That pre-filled `fooBar` with `"two"`. The kebab value landed on `foo-bar`, and the alias step never overwrites a key that is already set.

The fix is in `src/_parser.ts`. Defaults are no longer passed to `node:util`. They are applied after alias resolution, and only to names where no alias was given a value.

The regression test is `test/kebab-default.test.ts`.

I haven't committed anything.
