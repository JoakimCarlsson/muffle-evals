Status: I've read `base.rs` and now I'm threading a comparator type `C` through it, using a scripted rewrite and then fixing whatever the compiler flags.

Now fix the doubled `C`, the struct fields, the constructors, and the helper functions.

Status: `base.rs` compiles with the comparator; I'm now applying the same transformation to `map.rs` and `set.rs`.

Status: fixing the `new()`/`with_comparator` split in `map.rs` that my script got slightly wrong, then the same for `set.rs`.

Status: the remaining error is in my own test (`RangeInclusive<&str>` can't be a `RangeBounds<str>`). I'm switching it to a `(Bound, Bound)` pair.

`SkipMap`, `SkipSet` and `base::SkipList` now take a runtime comparator as a new last type parameter `C`, defaulting to `BasicComparator`. All tests pass, including the existing ones, with `cargo test` (unit, integration and doc-tests). I did not build the benches (they need nightly) or run clippy.

- **New module:** `crossbeam_skiplist::comparator` has `Equivalator`, `Comparator` and `BasicComparator`, as you specified. `BasicComparator` goes through the existing `Equivalent`/`Comparable` traits, so it orders exactly as today.
- **Type parameter:** `Entry`, `RefEntry`, `Iter`, `RefIter`, `Range`, `RefRange` and the map and set equivalents all carry `C` with the same default. Existing code that names `SkipMap<K, V>` compiles unchanged.
- **Constructors:** `with_comparator` exists on `SkipMap`, `SkipSet` and `base::SkipList` with the signatures you gave. `new()`, `Default` and `FromIterator` stay on `BasicComparator` only.
- **Comparisons:** every lookup, insert, remove, bound, range and iterator step now goes through the comparator instead of `Ord`. That includes the `>=` checks inside `Iter`/`RefIter` and the duplicate-key check when linking tower levels. Lookups need `C: Comparator<K, Q>`, so the query type can differ from the stored key type.
- **Tests added:**
  - `tests/map.rs`: a case-insensitive comparator on a `SkipMap<String, u32, _>`. It covers `get("aBc")` with a `&str`, `contains_key`, a range query and `remove`.
  - `tests/map.rs` and `tests/set.rs`: a reverse-order comparator on a map and a set.

I left out `Debug` and `Default` for non-default comparators, and a CHANGELOG entry.

Calling `range` with a `&str` query on `String` keys needs a `(Bound<&str>, Bound<&str>)` pair, because `RangeInclusive<&str>` is not `RangeBounds<str>`. That is how `RangeBounds` works, not something I changed.
