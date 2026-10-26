I’ll trace how dotted-key replacements are serialized, fix the ordering, and add a regression test for the round trip.

The replacement logic already handles this for regular tables, but excludes arrays of tables. I’ve extended it to cover arrays of tables and verified that `c.d` stays at the top level, including when another table follows.

Fixed the replacement logic so arrays of tables move after following dotted keys, preserving `c` at the top level.

Added regression coverage for your example and a case with a subsequent table. All 362 available tests pass. The external TOML conformance suite could not run because its fixture files are missing.
