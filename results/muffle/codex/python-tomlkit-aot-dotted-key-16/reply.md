I’ll trace how the replacement is serialized, fix the table ordering, and add a regression test that checks the document survives a round trip.

The replacement code already moves regular table headers past dotted-key siblings, but it omitted arrays of tables. I’ve extended that logic to arrays of tables. The regression tests pass for one and multiple array entries, including when another table follows.

Fixed the replacement logic so array-of-tables headers move after following dotted keys, preserving top-level `c`.

Added round-trip regression tests for single and multiple array entries.

Validation: 364 tests passed. The external TOML conformance suite could not run because its fixture files are missing.
