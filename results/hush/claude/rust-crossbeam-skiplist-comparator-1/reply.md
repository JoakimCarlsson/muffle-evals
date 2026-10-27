Reading `base.rs` to plan the type-parameter changes.

Fixing remaining compile errors: add the `C` bound to the insert/remove impl and replace the key `==` with the comparator.

`base.rs` compiles. Now `map.rs` and `set.rs`.

Now the manual structural edits: constructors, Default, FromIterator, `C` bounds on Send impls.

Done. `crossbeam_skiplist::comparator` is in with `Equivalator`, `Comparator` and `BasicComparator`. `SkipList`, `SkipMap`, `SkipSet` and their entry, iter and range types take a last type parameter `C = BasicComparator`, plus `with_comparator` on each.

All existing tests and doctests pass. The new `tests/comparator.rs` passes, including the case-insensitive `get("aBc")` lookup. I did not run the benches, which need nightly. Clippy's only remaining warnings are the existing busy-wait loops in `tests/base.rs`.

- **Looser bounds:** `K: Ord` is gone from the generic impls. They now need `C: Comparator<K, K>`, or `C: Comparator<K, Q>` for lookups.
- **Default-only impls:** `new()`, `Default` and `FromIterator` exist only for `BasicComparator` and still require `Ord`.
- **Closures:** there is no blanket `Comparator` impl for closures, so a boxed closure needs a small wrapper type that implements the traits. I didn't add one because you didn't ask for it.
- **`IntoIter`:** the owning iterator types stay without `C`.
