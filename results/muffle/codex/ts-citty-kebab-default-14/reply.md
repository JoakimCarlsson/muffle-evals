I’ll check how argument names and defaults are resolved, fix the precedence issue, and add a regression test.

The parser applies defaults before resolving aliases, so the default blocks the supplied value from reaching `fooBar`. I’ve moved defaults after alias resolution and added regression coverage, including enum validation. I’ll run the checks using the installed tools; `pnpm` isn’t available here.

Fixed default precedence by resolving explicit values across aliases before applying defaults. `--foo-bar one` now sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression tests for aliases, defaults, boolean flags, and enum validation. All 72 tests, type checks, lint, and formatting checks pass.
