Let me see how the parser handles defaults and aliases.

Passing `--foo-bar one` now sets `fooBar` to `"one"`, and `"foo-bar"` is `"one"` too. All 65 tests pass, including two new ones in `test/args.test.ts`: one for your repro and one checking the default still applies when no flag is passed.

The cause was in `src/_parser.ts`. The default was handed to `node:util`'s `parseArgs` for the `fooBar` key. Your `--foo-bar one` landed on the `foo-bar` key, so `fooBar` already held `"two"`. The step that copies values between aliases only fills a key that is still undefined, so it never overwrote the default.

Defaults are now applied after parsing, and only when neither the option nor any of its aliases was given. The value then propagates to all the alias names as before.

I haven't committed anything.
