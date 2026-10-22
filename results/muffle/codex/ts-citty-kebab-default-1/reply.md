I’ll check how argument defaults and kebab-case names are handled, add a regression test, and fix the parser.

Defaults were being applied before alias values were copied, so the default blocked the explicit value. I moved default handling after alias resolution. The regression tests pass, including enum validation through `--foo-bar`; I’m checking lint and types now.

Fixed default handling so explicit alias values take precedence. `--foo-bar one` now sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression tests for defaults, aliases, boolean flags, and enum validation. All 71 tests, lint, formatting, and type checks pass.
