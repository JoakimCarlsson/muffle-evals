I’ll check how argument names and defaults interact, fix the precedence issue, and add a regression test.

The parser applies defaults before copying values between aliases, so the default blocks the value passed as `--foo-bar`. I’ll apply defaults after resolving explicit values and test both casing variants, declared aliases, and boolean defaults.

Fixed default precedence: explicit CLI values now resolve across aliases before defaults are applied. `--foo-bar one` produces both `fooBar: "one"` and `"foo-bar": "one"`.

Added regression coverage for casing variants, declared aliases, and boolean defaults.

Validation passed: all 71 tests, type checking, lint, and formatting.
