I’ll check argument parsing and default handling, fix the override behavior, and add a regression test.

The parser applies defaults before resolving aliases, so the default blocks the supplied value from reaching `fooBar`. I’ve moved default handling after alias resolution and added coverage for both naming styles, short aliases, enum validation, and boolean defaults. I’m running the checks now.

Fixed: aliases now resolve before defaults are applied, so `--foo-bar one` sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for naming variants, short aliases, enum validation, and boolean defaults.

All 66 tests, type checks, lint, and formatting pass. Ran the checks directly because `pnpm` isn’t installed.
