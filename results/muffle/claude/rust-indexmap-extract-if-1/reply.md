Map side done; now adding the set side, then tests.

`IndexMap::extract_if` and `IndexSet::extract_if` are added with the signatures you gave. The full test suite passes with all features, and the crate builds with `--no-default-features`. Nothing is committed.

- **New types:** `ExtractIf` is a public iterator in both `indexmap::map` and `indexmap::set`. It implements `Iterator`, `FusedIterator` and `Debug`. The `Debug` output shows only the type name, not the remaining entries.
- **Behaviour:** it follows your description, including the lazy visiting, the `size_hint` of `(0, Some(entries left in range))`, and `&mut V` for maps.
- **Early drop and panics:** if the iterator is dropped early, or the predicate panics, everything is put back in order and the lookup table is rebuilt. The entry the predicate was looking at when it panicked is lost.
- **Leak caveat:** if you `mem::forget` the iterator, the map is left with only the entries before the range and a stale lookup table. Lookups may then panic but are not unsafe. I couldn't find a safe way to avoid this.
- **Implementation:** I used no unsafe code and no `Vec::extract_if`, because the crate's minimum Rust version is 1.63. The cost is that creating the iterator moves the entries from the range onward into separate vectors. That is O(n), the same order as the rebuild that follows.
- **Visibility:** `mod core` in `src/map.rs` is now `pub(crate)` so the set module can use the shared logic. Nothing new is exposed publicly through it.
- **Tests and docs:** I added unit tests for map and set covering ranges, `.take(n)`, lookups after the call and `size_hint`. The rustdoc examples use your snippet. I also added a `2.10.0 (unreleased)` entry to `RELEASES.md`.

The main code is in `src/map/core.rs` and `src/map/iter.rs`.
