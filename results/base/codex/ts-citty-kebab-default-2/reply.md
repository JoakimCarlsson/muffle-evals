I’ll check how argument names and defaults are parsed, add a regression test, and fix the override behavior.

The parser applies defaults before resolving aliases, so the default blocks the supplied value from reaching `fooBar`. The regression test reproduces this in both naming directions. I’ll resolve supplied values first, then apply defaults to arguments that are still unset.

Fixed alias handling so CLI values resolve before defaults are applied. `--foo-bar one` now sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for both naming directions, short aliases, defaults, and enum validation.

All 65 tests pass, along with lint, formatting, and type checks.
