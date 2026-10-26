I’ll check how replacement affects table ordering, add a regression test, and fix the serialization.


The replacement code already handles this ordering for regular tables, but excluded arrays of tables. I extended that logic to arrays of tables. The regression tests now pass at the document root and inside a parent table, including when another table follows.


Fixed array-of-tables replacement so following dotted keys remain in their original scope. Added regression coverage for root and nested tables, with and without a subsequent table.

Validation: 364 tests passed. The external TOML conformance suite could not run because its fixture files are missing.
