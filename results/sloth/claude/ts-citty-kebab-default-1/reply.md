`--foo-bar one` now sets `fooBar` to `"one"`, and `"foo-bar"` is `"one"` too. I added a test for your exact case in `test/args.test.ts`. The full suite passes (64 tests) and there are no type errors.

The default was being handed to `node:util`'s `parseArgs` under the camelCase name. `fooBar` therefore always had a value, and the later step that copies a value between the `fooBar` and `foo-bar` names saw `fooBar` as already set and skipped it. In `src/_parser.ts` I now apply defaults after that copy step, so a value passed under any spelling takes priority. The default is then copied to the other spellings only where they're still unset.

I haven't committed anything.
