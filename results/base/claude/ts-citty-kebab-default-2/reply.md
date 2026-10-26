Probably watch mode or a missing file; check.

`--foo-bar one` now sets `fooBar` to `"one"`, and `"foo-bar"` is `"one"` as well. The full test suite passes.

The cause was in `src/_parser.ts`. The defaults were handed to Node's `parseArgs`. That filled `fooBar` with `"two"` before citty had linked `foo-bar` and `fooBar` as aliases. Alias syncing only copies a value when the other name is unset, so the default blocked your value.

Defaults are no longer passed to Node's `parseArgs`. They are applied after your explicit values have been copied across the aliases, and only if no name for that option was given.

I added a regression test to `test/args.test.ts` using your exact `fooBar` enum example. I haven't committed anything.

That notification is the first attempt, which hung on a stray `cat > /tmp/x.mjs` that sat waiting for input. It was stopped at its time limit. The work doesn't need restarting.

The parser edit had already been applied before the hang. I then re-ran the test append and the full suite on their own, and all 64 tests passed. There's nothing left to do on the fix, and nothing is committed.
