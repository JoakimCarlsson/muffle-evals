I’ll check how replacement affects serialization order, add a regression test, and run the relevant tests.

The replacement code already moves regular table headers past following values and dotted keys, but it missed arrays of tables. I’ve extended that logic to arrays of tables; the document tests pass, including the new regression cases.

Fixed array-of-tables replacement so following dotted keys and values remain at the top level. Added regression coverage for round-trip correctness.

Validation: 363 tests passed. The external TOML conformance tests could not run because their fixture files are missing.
