Fixed in `src/header/map.rs`. Both `Iter::size_hint` and `IterMut::size_hint` now report a correct lower bound, and the `header_map` tests pass. I only ran that test target, not the full suite.

**Cause:** `entry` is the index of the entry currently being iterated. When the iterator has no cursor, that entry is already fully consumed. The old code computed `len - entry`, which counted it again. That's why your example reported `(1, _)` just before `next()` returned `None`.

**Fix:** With a cursor, the lower bound stays `len - entry`. Without a cursor, it is `len - entry - 1`, using `saturating_sub` so an empty map gives 0.

I added a regression test in `tests/header_map.rs`, `iter_size_hint_lower_bound_is_accurate`. It covers an empty map, a single entry, and a map with a multi-value header. I didn't confirm that the new test fails on the old code.

I made no commit.
