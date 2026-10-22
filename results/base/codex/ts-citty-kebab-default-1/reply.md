I’ll check how defaults interact with argument aliases, fix the precedence issue, and add a regression test.

The parser applies defaults before resolving aliases, which leaves the default in `fooBar` even when `foo-bar` has an explicit value. The regression tests also show that this bypasses enum validation. I’ll resolve explicit values across aliases before applying defaults.

Fixed: explicit CLI values now resolve across aliases before defaults are applied. `--foo-bar one` sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for both spellings, short aliases, enum validation, and boolean values.

All 69 tests, type checks, lint, and formatting checks pass.
