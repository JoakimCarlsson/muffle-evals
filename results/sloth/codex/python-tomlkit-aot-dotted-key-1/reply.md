I’ll trace the replacement and rendering paths, add a regression test, and run the relevant checks.

The shared replacement code already moves ordinary tables past following dotted keys, but excludes arrays of tables. I’ll extend that rule to arrays of tables and test round-tripping with following values, dotted keys, and table headers. No API, fixture, config, or export changes are needed.

Fixed the shared replacement logic so arrays of tables move past following top-level values and dotted keys, preserving their scope.

Added regression coverage for one or multiple array entries and following siblings.

Validation: 368 tests passed. Full-suite collection requires missing `toml-test` fixtures. Build and lint checks were blocked by unavailable tools.
