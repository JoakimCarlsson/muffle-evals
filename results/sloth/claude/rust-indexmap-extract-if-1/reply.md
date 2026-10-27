Adding the set side now: it wraps the same core extractor, with a predicate that only takes `&T`.

`IndexMap::extract_if` and `IndexSet::extract_if` are added with the signatures you gave. `cargo test` passes, including new tests for both: the map test runs your example, and I checked the behaviors you listed with it.

Each `ExtractIf` implements `Iterator`, `FusedIterator` and `Debug`, and `size_hint` is `(0, Some(entries left in range))`. The new types are exported as `indexmap::map::ExtractIf` and `indexmap::set::ExtractIf`.

- **Implementation:** `extract_if` pulls everything from `range.start` onward out of the entries `Vec`. It pushes the kept entries back as it goes and restores the unvisited ones on drop. It is safe code, with no `Vec::extract_if` (which the 1.63 MSRV rules out).
- **Cost:** it allocates a copy of the tail, and it removes the hash indices for entries from `range.start` onward and re-inserts them at the end. The cost is O(entries from `range.start` to the end), not O(range).
- **Leaks:** `mem::forget` on the iterator leaves the map truncated at `range.start`, like `drain`.
- **Panics:** a panicking predicate counts as keeping that entry. The entry stays in the map and the rest is restored on unwind.
- **Left out:** `Debug` prints only the type name, `ExtractIf { .. }`, with no entry contents. There is no `DoubleEndedIterator` or `ExactSizeIterator`, and no rayon variant.

I didn't commit anything.
