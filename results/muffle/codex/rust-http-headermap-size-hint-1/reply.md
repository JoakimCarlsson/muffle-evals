I’ll check how the iterator tracks remaining entries, fix the size hint, and add a regression test for the exhausted case.

The lower bound still counts the current header after its last value has been yielded. The mutable iterator uses the same calculation, so I’ll fix both. I’ll test empty maps, single values, and multiple values per header, including the `values()` wrappers.

Fixed the lower bound calculation in `HeaderMap::iter()` and `iter_mut()`, which also fixes their `values()` wrappers. Exhausted entries no longer count toward the lower bound.

Added regression coverage for empty maps, single values, multiple headers, and repeated values.

Validation: all 415 tests pass; formatting and diff checks pass.
