I’ll check how argument aliases and defaults interact, add a regression test, and run the build and relevant tests.

Defaults are being applied before aliases are resolved, so the default blocks the supplied value. I’ve moved default handling later and added tests for both spellings and omitted input. `pnpm` isn’t available here, so I’ll use the installed build and test executables.

Fixed default handling in the shared parser. `--foo-bar one` now sets both `fooBar` and `"foo-bar"` to `"one"`.

Build and all 31 relevant tests passed, including regressions for both spellings and omitted input.

No new options or dependencies. Full suite and lint were not run.
