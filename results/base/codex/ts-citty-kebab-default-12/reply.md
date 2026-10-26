I’ll check how aliases and defaults are applied, fix the precedence issue, and add a regression test.

The parser applied defaults before resolving aliases, so the default blocked the value passed through `--foo-bar`. I’ve moved defaults after alias resolution. All 67 tests pass, including the new regression cases; I’m finishing formatting and coverage checks.

Fixed defaults to apply after alias resolution. `--foo-bar one` now sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for camelCase, kebab-case, explicit aliases, and omitted arguments.

Validation: all 67 tests pass with coverage; type, lint, and formatting checks pass.
