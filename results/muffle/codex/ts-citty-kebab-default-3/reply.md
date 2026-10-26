I’ll check how argument names and defaults are handled, fix the override behavior, and add a regression test.

The parser applies defaults before resolving aliases, so the default blocks the value passed through `--foo-bar`. I’ve changed it to apply a default only when neither the option nor an alias has a value. The regression test covers both case variants, a short alias, and enum validation.

`pnpm` isn’t installed here, so I’m running the checks through the installed tools.

Fixed. Defaults now apply only when neither the argument nor its aliases has a supplied value. `--foo-bar one` sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for case variants, short aliases, boolean flags, empty strings, and enum validation.

All 68 tests, type checks, lint, and formatting checks pass.
