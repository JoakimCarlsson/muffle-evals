Editing `base.rs` to thread the new `C` comparator parameter through it, using a scratch script outside `/tmp`.

Fixing the remaining `map.rs` impl headers (`IntoIterator`, `Default`, `FromIterator`, `new`/`with_comparator`), then repeating for `set.rs`.

Everything compiles. Adding a test for the case-insensitive comparator and running the suite.

Done. `crossbeam_skiplist::comparator` is added, and `SkipMap`, `SkipSet`, `base::SkipList` and their entry, iterator and range types take a last type parameter `C` defaulting to `BasicComparator`. `with_comparator` exists on all three collections. Lookups, inserts, removes and ranges use the comparator. All tests pass, including two new ones, but the new tests only cover `SkipMap` and `SkipSet`, not `base::SkipList::with_comparator` directly.

- **Tests:** The new ones are in `tests/map.rs`, one for a case-insensitive `SkipMap<String, u32, _>` and one for a reverse-ordered `SkipSet`. In the first, `get("aBc")` finds `"abc"`, and `range`, `remove` and `iter().rev()` also work.
- **`new()`, `Default` and `FromIterator`:** These stay `BasicComparator`-only. `new()` and `FromIterator` still require `K: Ord`.
- **Not run:** Clippy fails on `benches/*` because they need nightly. The lib itself checks with no warnings.
- **Not added:** There is no impl that turns a boxed closure into a `Comparator`. You implement the two traits yourself, as the case-insensitive example does.
