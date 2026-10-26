I’ll trace how replacements are ordered, fix the serialization, and add a regression test for this case.

The replacement logic already handles this for regular tables, but leaves out arrays of tables. I’ve extended it so the new array header moves past following inline keys. The regression tests cover dotted and plain siblings, with and without a later table.

Fixed replacement ordering so an array of tables assigned over a dotted-key prefix no longer captures following keys.

Added regression tests for dotted and plain siblings, including cases with a later table.

Validation: 364 tests passed. The full suite could not collect because the `toml-test` fixture files are missing.
