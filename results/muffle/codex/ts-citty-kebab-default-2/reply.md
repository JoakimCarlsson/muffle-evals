I’ll check how argument aliases and defaults interact, add a regression test, and fix the parsing order.

The parser applied defaults before resolving aliases, so the default blocked the value passed through `--foo-bar`. I’ve moved defaults after alias resolution. The regression tests pass for kebab-case, camelCase, short aliases, and omitted arguments; I’m running the full checks now.

Fixed: aliases now resolve before defaults are applied, so `--foo-bar one` sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for camelCase, kebab-case, short aliases, and defaults when omitted.

All 68 tests, type checks, lint, and formatting checks pass.
