I’ll check how defaults and argument aliases are applied, fix the precedence, and add a regression test.

The parser applied the default before resolving aliases, which prevented the supplied value from reaching `fooBar`. The fix checks for supplied aliases before applying defaults. The enum regression tests pass, including validation of invalid values. I’m checking the full suite now.

Fixed default precedence: explicit CLI values supplied through aliases now override defaults, so `--foo-bar one` sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression tests for enums, strings, booleans, empty values, and negation.

All 70 tests pass, along with type, lint, and formatting checks.
