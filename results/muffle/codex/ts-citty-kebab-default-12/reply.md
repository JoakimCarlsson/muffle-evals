I’ll check how defaults and kebab-case aliases are applied, fix the precedence issue, and add a regression test.

Fixed defaults being applied before alias resolution. Passing `--foo-bar one` now sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for aliases, defaults, booleans, and enum validation. All 69 tests, lint, formatting, and type checks pass.
