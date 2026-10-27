`IndexMap::extract_if` and `IndexSet::extract_if` are in, with the signatures you gave. The full test suite, clippy and a `--no-default-features` build all pass, and the code is formatted. I added unit tests for the map and the set, plus doc examples. The map's doc example is your snippet. I did not commit anything.

`ExtractIf` is public in `indexmap::map` and `indexmap::set`. It implements `Iterator`, `FusedIterator` and `Debug`, and `size_hint` is `(0, Some(entries left in the range))`.

- **How it works:** it takes the entries from the range's start onward out of the map and puts each kept entry back as the predicate visits it. The map is therefore consistent at every step, and lookups by key work after a partial iteration. Dropping it early restores the unvisited entries, including everything past the range, in their original order.
- **Panics and leaks:** if the predicate panics, the entry it was testing is lost, and the map is still consistent afterwards. If the iterator is leaked with `mem::forget`, the unvisited entries are lost, but the map stays consistent.
- **Unsafe code:** none; the crate denies it, and this is built on `split_off` and `vec::IntoIter`.
- **Cost:** it allocates a temporary `Vec` for the entries from the range's start to the end of the map, so an extraction starting at index 0 copies the whole map's entries once.

The shared implementation is `ExtractCore` in `src/map/core.rs`. To let the set reach it, I changed `mod core` in `src/map.rs` to `pub(crate) mod core`.

I didn't add a `RELEASES.md` entry; say if you want one.
