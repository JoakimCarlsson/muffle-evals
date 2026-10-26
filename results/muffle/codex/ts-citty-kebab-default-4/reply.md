I’ll check how argument aliases and defaults interact, add a regression test, and fix the parser.

The parser applies defaults before resolving aliases, so the default blocks the supplied value. The regression tests reproduce this and show that it also lets invalid enum values bypass validation. I’ll apply defaults only when neither the argument nor an alias has a value.

Fixed: defaults now apply only when neither the argument nor an alias was supplied. `--foo-bar one` sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression tests for alias overrides, default propagation, and enum validation. All 68 tests pass, along with lint, formatting, type checks, and build.
