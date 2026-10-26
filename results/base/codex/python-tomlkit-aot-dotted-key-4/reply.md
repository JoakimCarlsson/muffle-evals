I’ll check how the replacement affects serialization, add a regression test, and run the relevant tests.

The replacement logic already handles this for regular tables, but omitted arrays of tables. I’ve extended it so the new array’s header is placed after following inline keys, keeping those keys at the top level. The regression tests pass; I’m running the full suite now.

Fixed the replacement logic so assigning an array of tables over a dotted-key prefix preserves following top-level keys.

Added regression coverage for dotted siblings, plain siblings, and following tables.

Validation: 364 tests passed. The external TOML conformance suite could not run because its fixture files are missing.
