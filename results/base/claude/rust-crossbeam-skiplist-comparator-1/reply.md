Adding the `C` parameter across `base.rs`. Next I'll fix the impl headers and bounds by hand.

Updating `map.rs` and `set.rs` with the same `C` parameter changes now.

Everything passes. Now I'll run rustfmt, then add a test for runtime comparators, including a case-insensitive map and a boxed closure.

Test bug (an unsized `str` range). I'll switch it to a `(Bound<&str>, Bound<&str>)` range.

`SkipMap`, `SkipSet` and `base::SkipList` now take a comparator type `C`, defaulting to `BasicComparator`. The existing tests and doctests still pass, and a new test file passes too. Clippy shows only the two spin-loop warnings in `tests/base.rs` that were already there. The crate also builds with `--no-default-features --features alloc`.

- **`comparator` module:** `crossbeam_skiplist::comparator` (in `src/comparator.rs`) has `Equivalator<L, R = L>`, `Comparator<L, R = L>: Equivalator<L, R>`, and the zero-sized `BasicComparator`. `BasicComparator` derives `Clone`, `Copy`, `Debug` and `Default`, and is implemented through the existing `Equivalent`/`Comparable` traits, so it orders exactly as before.
- **Defaulted type parameter:** `C` is the last parameter, defaulting to `BasicComparator`, on `SkipList`, `SkipMap`, `SkipSet` and the entry, iterator and range types in `base`, `map` and `set`. Code that writes `SkipMap<K, V>` or calls `SkipMap::new()` compiles unchanged, and `new()` still exists only for `BasicComparator`.
- **Constructors:** `with_comparator` exists on `SkipMap`, `SkipSet` and `base::SkipList`, with the signatures you gave.
- **Ordering:** every `K: Ord` or `K: Comparable<Q>` bound is now `C: Comparator<K>` or `C: Comparator<K, Q>`. This covers lookups, insert, remove, range, iterator head/tail checks and `Entry`/`RefEntry` `next`/`prev`/`remove`.
- **Equality check:** the equal-key check while building the tower used to be `==` on `K`. It now goes through the comparator.

A few things beyond the brief:
- `Default` and `FromIterator` are now implemented for any `C: Default`.
- The `SkipList` `Send`/`Sync` impls require `C: Send + Sync`.
- The `Debug` impls no longer require `K: Ord`.

`tests/comparator.rs` has three tests:
- A case-insensitive `SkipMap<String, u32, _>` where `"abc"` and `"ABC"` are one key and `get("aBc")` with a `&str` finds it.
- A `SkipSet` ordered by a boxed closure, with a reversed ordering.
- `BasicComparator` giving the same results as `new()`.

I also added doc examples on both `with_comparator` methods.

I didn't update `CHANGELOG.md`, and nothing is committed.
