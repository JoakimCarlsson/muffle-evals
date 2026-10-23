I’ll trace how dotted keys are serialized when replaced by an array of tables, add a regression test, and fix the ordering.

The replacement logic already moves ordinary tables past following dotted keys, but it excluded arrays of tables. I’ve extended that logic to cover them. The regression tests reproduce the bug with one or multiple entries, including when another table follows.

Fixed the replacement logic so arrays of tables move after following dotted keys, preserving top-level `c` when the output is parsed again.

Added four regression cases. All 364 available tests pass. The TOML conformance suite could not run because its fixture files are missing.
