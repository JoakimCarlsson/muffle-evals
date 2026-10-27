I’ll check how defaults interact with kebab-case input, fix the precedence issue, and add a regression test.

Defaults are being applied before aliases are resolved, so the default blocks the value passed through `--foo-bar`. I’ve changed defaults to apply only when neither the argument nor an alias was supplied, and added regression coverage. I’ll run the checks using the installed tools; `pnpm` isn’t available here.

Fixed: `--foo-bar one` now overrides the `fooBar` default and sets both keys to `"one"`.

Defaults apply only when neither the argument nor an alias was supplied. Added regression tests covering enums, strings, booleans, aliases, and enum validation.

All 69 tests pass, along with type, lint, and formatting checks.
