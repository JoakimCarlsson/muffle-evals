I fixed `size_hint` so it no longer reports a lower bound of 1 once the iterator is exhausted. The `header_map` test file passes (36 tests), including a new regression test.

**Cause:** the lower bound was `entries.len() - self.entry`. That assumes the entry at `self.entry` is still waiting to be yielded. After the last value of an entry is yielded, the cursor is `None` and that entry is already used up. For a one-entry map the bound therefore stayed at 1 after the only item was returned.

**Fix:** in `src/header/map.rs`, when the cursor is `None` the current entry no longer counts. The subtraction saturates, so an empty map gives 0. I applied the same change to `IterMut::size_hint`, which had the same bug.

**Test:** `iter_size_hint_lower_bound_is_accurate` in `tests/header_map.rs` covers both `iter` and `iter_mut`. It uses a map that includes a multi-value header. It asserts that the lower bound is 0 whenever `next()` returns `None`.

I haven't committed anything.
