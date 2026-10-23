I’ll check how aliases and defaults interact, fix the shared parser, and add a regression test for this case.

The parser applies defaults before it resolves aliases, so the default blocks the value supplied through `--foo-bar`. I’ll defer defaults until explicit values and negated flags are known.

The change belongs in `src/_parser.ts`, with coverage in the existing argument tests. I checked the command caller, exports, and types; they need no changes. No new options or dependencies are needed.

Fixed the shared parser so `--foo-bar one` overrides the default and sets both `fooBar` and `"foo-bar"` to `"one"`.

Added regression coverage for aliases, omitted values, empty strings, booleans, and enum validation.

All 71 tests, lint, formatting, type checks, and build passed. Used local tools directly because `pnpm` wasn’t installed.
