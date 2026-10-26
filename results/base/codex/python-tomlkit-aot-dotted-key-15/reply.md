I’ll check how dotted keys and array-of-tables replacements are serialized, fix the ordering, and add a regression test.

Fixed the replacement logic so an array of tables moves after following inline keys, preserving top-level siblings such as `c.d`.

Added four regression cases covering dotted siblings, plain values, subsequent tables, and repeated dotted prefixes.

Validation: 364 tests passed. The external TOML conformance suite could not run because its fixture files are missing.
