I’ll check how replacement affects table ordering, add a regression test, and run the relevant tests.

The replacement code already moves regular table headers past following dotted keys, but it omitted arrays of tables. I’ve extended that handling to arrays of tables. The regression tests now pass, including a case with another table after the dotted keys.

Fixed array-of-tables replacement to place its header after following dotted keys, preserving top-level `c` when the output is parsed again.

Added regression coverage. All 362 available tests pass. The external TOML conformance tests could not run because their fixture checkout is missing.
