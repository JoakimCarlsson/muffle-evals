I’ll trace how replacement affects key ordering, fix the serialization, and add a regression test for the round trip.

The replacement logic already moves ordinary tables past following inline keys, but it missed arrays of tables. I extended that logic to cover arrays of tables. The document tests pass, including new cases with dotted siblings, plain siblings, and a following table.

Fixed replacement ordering so an array of tables assigned over a dotted key moves after following inline keys, preserving top-level siblings on round trip.

Added regression coverage. All 363 available tests pass; the external TOML conformance suite could not run because its fixture files are missing.
