Passing `--foo-bar one` now sets `fooBar` to `"one"` (and `"foo-bar"` to `"one"`). With no flag, `fooBar` is still `"two"`. The full test suite passes (64 tests).

The cause was in `src/_parser.ts`. The default was handed to Node's `parseArgs` for `fooBar`, so `fooBar` already had a value. The alias step only copies a value across when the target is undefined, so `foo-bar`'s `"one"` never replaced the default.

The fix applies defaults after the alias step instead. A value passed under any spelling wins, and the default fills in only when none was passed. The result is then copied across all spellings again, so `"foo-bar"` and `fooBar` always agree.

I added a regression test in `test/kebab-default.test.ts` covering both the override and the default-only case.
