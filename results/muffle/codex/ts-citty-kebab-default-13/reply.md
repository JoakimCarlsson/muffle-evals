I’ll check how argument aliases and defaults are applied, fix the precedence, and add a regression test.

The parser applies defaults before resolving aliases, so the default and the supplied value both survive. I’ll apply a default only when neither the argument nor any of its aliases has a value.

Fixed default handling so `--foo-bar one` sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for both naming styles, explicit aliases, omitted defaults, and enum validation.

All 65 tests, type checks, lint, and formatting checks pass.
