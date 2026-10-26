Passing `--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. The full suite passes (64 tests), including a new regression test.

**Cause:** `src/_parser.ts` handed the defaults to `node:util`'s `parseArgs`. So `fooBar` was already `"two"` when the parser later copied values between aliases. That copy only fills a name that is still `undefined`, so `foo-bar: "one"` never reached `fooBar`.

**Fix:** The parser no longer passes defaults to `node:util`. It applies them after alias propagation, and only to names that are still `undefined`. It then copies the result out to the aliases, so `fooBar` and `foo-bar` both show the default when nothing is passed.

The regression test is in `test/kebab-default.test.ts`. It covers the kebab-case override and the case where no flag is passed, which still gives `"two"`.

I haven't committed anything.
