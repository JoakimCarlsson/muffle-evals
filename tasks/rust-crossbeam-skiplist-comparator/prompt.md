I'd like `crossbeam-skiplist` to let me pick the ordering a `SkipMap` or `SkipSet` uses at runtime, instead of always using the key type's `Ord`. My use case is a map of string keys where case sensitivity is a setting, or where the user hands me a boxed comparison closure.

Please add a new public module `crossbeam_skiplist::comparator` with:

- `trait Equivalator<L: ?Sized, R: ?Sized = L>` with `fn equivalent(&self, lhs: &L, rhs: &R) -> bool`.
- `trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R>` with `fn compare(&self, lhs: &L, rhs: &R) -> std::cmp::Ordering`.
- `struct BasicComparator`, zero-sized, deriving `Clone`, `Copy`, `Debug` and `Default`, implementing both traits through the crate's existing `Equivalent`/`Comparable` traits, so it behaves exactly like today's ordering.

`SkipMap`, `SkipSet` and the underlying `base::SkipList` get a new last type parameter `C` defaulting to `BasicComparator`, and so do their entry, iterator and range types (`Entry`, `RefEntry`, `Iter`, `RefIter`, `Range`, `RefRange` and the map and set equivalents), so that existing code that names `SkipMap<K, V>` or calls `SkipMap::new()` keeps compiling and behaving the same. `new()` stays tied to `BasicComparator`.

New constructors:

```rust
SkipMap::<K, V, C>::with_comparator(comparator: C) -> Self
SkipSet::<T, C>::with_comparator(comparator: C) -> Self
base::SkipList::<K, V, C>::with_comparator(collector: Collector, comparator: C) -> Self
```

Every lookup, insert, remove and range operation must then use the comparator's `compare`/`equivalent` instead of `Ord`, with the query key type allowed to differ from the stored key type as long as `C: Comparator<K, Q>`. For example a `SkipMap<String, u32, _>` built with a comparator that ignores case should treat `"abc"` and `"ABC"` as the same key, and `get("aBc")` with a `&str` should find it.

Please add this.
