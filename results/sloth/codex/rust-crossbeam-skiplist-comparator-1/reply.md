I’ll trace the ordering code and public types, add comparator support, then test runtime ordering and borrowed-key lookups.


The ordering checks live in the shared skip-list code, including the checks that stop forward and reverse iterators. I’m routing those through the comparator and keeping `new()` tied to `BasicComparator` for compatibility.


The focused tests pass for case-insensitive `String`/`str` lookups, duplicate-key replacement, reverse ordering, boxed closures, and keys without `Ord`. The `alloc`-only build also passes. I’m checking the full crate test suite and documentation examples now.


Implemented runtime comparators for `SkipMap`, `SkipSet`, and `base::SkipList`, including entries, iterators, and ranges. Existing constructors retain their default behavior. Boxed comparison closures and heterogeneous lookups are supported.

Validation passed: 87 integration tests, 40 doctests, and the `alloc`-only build.

No dependencies or unrelated features added. Full workspace tests were not run.
