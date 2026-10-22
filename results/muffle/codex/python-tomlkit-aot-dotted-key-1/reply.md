I’ll trace how dotted-key entries are replaced, fix the ordering, and add a regression test for the round trip.

The replacement code already handles this ordering issue for regular tables, but excludes arrays of tables. I’ve extended that handling, and the regression cases pass with both dotted siblings and explicit tables following the replaced key.

Fixed dotted-key replacement so arrays of tables move after inline siblings, preserving top-level `c` when the output is parsed again.

Added regression coverage. All 363 available tests pass. The full suite is blocked by a missing `toml-test` fixture file.
