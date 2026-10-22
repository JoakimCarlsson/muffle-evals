Fixed: `size_hint` on `HeaderMap::iter()` and `iter_mut()` no longer reports a lower bound of 1 when the iterator is exhausted. The new regression test and the existing `header_map` and lib tests pass.

**Cause:** the lower bound was `entries.len() - self.entry`. That always counts the current entry, even after the cursor has moved past its last value.

**Fix:** in `src/header/map.rs`, both `Iter` and `IterMut` now count the current entry only while the cursor is still inside it, and use `saturating_sub` so an empty map can't underflow.

**Test:** I added `iter_size_hint_lower_bound_is_accurate` to `tests/header_map.rs`. It checks an empty map and a map with multi-value entries, for both `iter` and `iter_mut`. At every step, a lower bound above 0 must be followed by `Some`.

I haven't committed anything.
