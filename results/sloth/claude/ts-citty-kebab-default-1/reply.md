`--foo-bar one` now overrides the default, so `fooBar` is `"one"` and `"foo-bar"` is `"one"`. The full suite passes (64 tests), including a new test for your example.

**Cause:** the parser gave defaults to `node:util` `parseArgs`, so `fooBar` was already `"two"` before alias propagation ran. Propagation only copies a value when the target is undefined, so the `foo-bar` value never reached `fooBar`.

**Fix:** in `src/_parser.ts`, defaults are now applied after the first alias propagation, only to keys still undefined, followed by a second propagation. The new test is in `test/args.test.ts`.
