I’ll check how argument names and defaults are handled, fix the precedence issue, and add a regression test.

The parser applies defaults before resolving aliases, so it treats the default as an existing value and keeps it. The regression tests reproduce this in both naming directions. I’ll resolve explicit values across aliases before applying defaults.

Fixed default handling so explicit CLI values resolve across aliases before defaults are applied. `--foo-bar one` now sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for both naming directions, enum validation, and alias defaults.

All 70 tests pass, along with lint, formatting, and type checks.
