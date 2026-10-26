I’ll check how defaults interact with argument name normalization, fix the precedence, and add a regression test.

The parser applied defaults before resolving aliases, so the default prevented the explicit kebab-case value from reaching `fooBar`. The fix checks both the option and its aliases before applying a default. The tests pass so far; I’m checking string and boolean cases, formatting, and types.

Fixed default precedence: `--foo-bar one` now sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for both spellings, aliases, enums, strings, and booleans. All 69 tests, lint, formatting, and type checks pass.

Validation ran on Node v26.11.1; Node v24 wasn’t available.
