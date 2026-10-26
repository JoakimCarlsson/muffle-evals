I’ll check how dotted keys and array-of-tables replacements are serialized, fix the ordering, and add a regression test.

The existing replacement logic handles regular table headers but misses array-of-tables headers. I extended it to cover both. The document tests pass, including new round-trip cases with dotted keys, plain values, and a following table. I’ll run the full suite next.

Fixed array-of-tables replacements so following dotted keys and plain values stay outside the new array’s header.

Added regression tests for round-trip correctness. All 363 available tests pass. The full suite cannot collect because the external `toml-test` fixtures are missing.
