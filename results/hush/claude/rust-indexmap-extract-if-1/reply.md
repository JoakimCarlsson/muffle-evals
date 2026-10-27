Test bug: key 1 was outside the first range, so it was never incremented. Fixing the expectation.

Done. Added `IndexMap::extract_if` and `IndexSet::extract_if`, with public `ExtractIf` in `map` and `set`. All tests pass, including new ones and doctests. Not checked: panicking predicates, Miri, and MSRV 1.63. The core in `src/map/core/extract.rs` uses `unsafe`, and `mem::forget` on the iterator leaves the map inconsistent.
