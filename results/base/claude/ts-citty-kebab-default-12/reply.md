Let me see how the parser handles defaults and aliases.

`--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. The full test suite passes (64 tests).

**Cause:** `parseRawArgs` in `src/_parser.ts` passed defaults straight to Node's `util.parseArgs`. That filled `fooBar` with `"two"` before alias handling ran. The value you passed landed on `"foo-bar"`. The alias step only copies a value across when the other key is empty, so it never overwrote `fooBar`.

**Fix:** The parser no longer hands defaults to Node. It applies them after alias propagation, and only when no alias of that argument got a value. The default is then set on the main name and its aliases.

I added a regression test to `test/args.test.ts` using your example.

I haven't committed anything.
