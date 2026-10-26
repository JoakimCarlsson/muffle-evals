I’ll check how defaults and argument aliases interact, fix the precedence, and add a regression test.

Fixed default precedence: defaults now apply only when neither the option nor an alias was supplied. `--foo-bar one` now sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for camelCase, kebab-case, short aliases, defaults, and enum validation.

All 65 tests, lint, formatting, and type checks pass.
