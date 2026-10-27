Wiring up the `extract_if` code is done. Compiling now to fix import paths.

Builds. Adding tests.

Done. `IndexMap::extract_if` and `IndexSet::extract_if` are added, with public `ExtractIf` types in `indexmap::map` and `indexmap::set`. All tests pass, including new ones for your example, partial iteration, `size_hint` and lookups after an early drop.

- **Memory-safe:** I avoided `unsafe` because the crate denies it. The cost is that the range's tail is moved into a temporary Vec and re-added, so an extraction pass is O(n).
- **Early drop:** the unvisited entries go back into the map on drop.
- **Not run:** `no_std` and rayon builds, and the 1.63 MSRV.

I also made `mod core` in `src/map.rs` `pub(crate)` so the set side can reach the shared extraction code.
