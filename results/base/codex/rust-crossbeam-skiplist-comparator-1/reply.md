I’ll inspect the ordering code, thread the comparator through the collection types, and test runtime ordering with heterogeneous queries.

The comparator is now threaded through the map, set, entries, and iterators. I also found key comparisons in iterator boundary checks and insertion retries; those need the custom ordering too. Next I’ll check compatibility and add regression tests.

The new tests pass for case-insensitive `String`/`str` lookup, boxed closures, keys without `Ord`, reverse ordering, ranges, and entry navigation. The existing collection tests passed as well. I corrected some documentation examples affected by the new type parameter and am running the full suite again, plus an alloc-only build.

Implemented runtime comparators across `SkipMap`, `SkipSet`, and `base::SkipList`, including entries, iterators, and ranges.

- Added `comparator::{Equivalator, Comparator, BasicComparator}`.
- Added `with_comparator` constructors and closure support, including boxed closures.
- Preserved existing default ordering and `new()`.
- Added tests for case-insensitive heterogeneous lookup, reverse ordering, and keys without `Ord`.

Validation passed: all 127 tests and documentation examples, plus the alloc-only build.
