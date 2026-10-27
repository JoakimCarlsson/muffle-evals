Mid-way through refactoring `base.rs` to add the `C` comparator parameter; a header-rewrite regex failed on a line, so I'm fixing it.

Now manual edits: struct, constructors, search internals, and the bound helpers.

Header script already turned it into `impl<K, V, C>`; adjusting the pattern.

Still wiring the `C` comparator through `map.rs`; now fixing the `new`, `Default` and `FromIterator` impls so they stay tied to `BasicComparator`, then compiling.

Code and tests are done and passing; I'm adding a changelog entry and cleaning up my scratch files.

`SkipMap`, `SkipSet` and `base::SkipList` now take a comparator at runtime through the new `crossbeam_skiplist::comparator` module. The existing tests and doctests pass, and clippy and `cargo doc` are clean. I also ran `cargo check --no-default-features --features alloc`, which succeeds. I haven't run the benches (they need nightly).

- **New module:** it has `Equivalator`, `Comparator` and `BasicComparator` as you specified. `BasicComparator` goes through the existing `Equivalent`/`Comparable` traits, so its ordering is the same as today's.
- **Type parameter:** `C = BasicComparator` is the new last parameter on the three collections and on `Entry`, `RefEntry`, `Iter`, `RefIter`, `Range` and `RefRange`, plus the map and set equivalents. Code that names `SkipMap<K, V>` or calls `SkipMap::new()` is unaffected, and `new()` is still tied to `BasicComparator`.
- **Constructors:** `with_comparator` exists on all three, with the signatures you gave.
- **Bounds:** every lookup, insert, remove, range, iteration and unlink path now calls the comparator instead of `Ord`. The stored key type `K` needs `C: Comparator<K, K>`, and a query type `Q` needs `C: Comparator<K, Q>`. For example, a `SkipMap<String, u32, _>` with a case-insensitive comparator can be queried with a `&str`.
- **Looser bounds:** I dropped the `K: Ord` bound from `Debug` impls, since they never compare keys.
- **Send/Sync:** `SkipList`'s `Send`/`Sync` impls now also require `C: Send + Sync`.
- **Unchanged:** `Default` and `FromIterator` stay tied to `BasicComparator`, and `IntoIter` has no comparator parameter.
- **Tests and docs:** I added two tests in `tests/map.rs`, one for a case-insensitive map and one for a reversed-order set. The case-insensitive test covers `get` with `&str`, `contains_key`, iteration in both directions, a range, `remove` and `len`. Doc examples are on `SkipMap::with_comparator` and `SkipSet::with_comparator`.
- **Changelog:** I added an "Unreleased" entry to `CHANGELOG.md`.

I did not commit anything.
