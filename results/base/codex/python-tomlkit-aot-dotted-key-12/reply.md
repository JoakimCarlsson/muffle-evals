I’ll check how dotted keys are replaced, add a regression test, and fix the serialization order.

The replacement code already moves regular table headers past dotted-key siblings, but it doesn’t apply that rule to arrays of tables. The regression test reproduces the bug both with and without a later table header. I’ll extend the existing rule to cover arrays of tables.

Fixed the replacement logic so array-of-tables headers appear after dotted-key siblings, preserving top-level `c`.

Added regression coverage with and without a following table. All 362 available tests pass. The external TOML conformance suite could not run because its fixture files are missing.
