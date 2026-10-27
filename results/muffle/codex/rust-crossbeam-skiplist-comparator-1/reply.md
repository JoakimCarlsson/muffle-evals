I’ll trace the current comparison paths, thread the comparator through the collection types, and add tests for runtime ordering and borrowed-key lookups.

The comparator is now threaded through the map, set, entries, and range iterators. I also found direct key comparisons in double-ended iteration and insertion retries; those need the comparator too so custom ordering stays consistent.

The new tests pass for case-insensitive `String`/`str` lookups, boxed comparison closures, and reverse ordering on keys without `Ord`. The alloc-only build also passes. I’m finishing the full test run, including the existing API examples.

Implemented runtime comparators across `SkipMap`, `SkipSet`, and `base::SkipList`, including entries, iterators, and ranges.

Added the public comparator traits, `BasicComparator`, and `with_comparator` constructors. Closures and boxed comparison closures are supported; existing `new()` behavior remains unchanged.

All 128 tests pass, including case-insensitive borrowed lookups and concurrent insertion. Clippy and the alloc-only build also pass.
