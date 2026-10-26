I’ll check how defaults and argument aliases are applied, fix the precedence issue, and add a regression test.

The parser applied defaults before resolving aliases, so the default blocked the supplied value. I’ve moved defaults after alias resolution. The regression tests pass, including enum validation through an alias; type, lint, and formatting checks also pass.

Fixed: explicit CLI values now resolve across aliases before defaults are applied. `--foo-bar one` sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for defaults, aliases, booleans, and enum validation. All 71 tests, type checks, lint, and formatting checks pass.
