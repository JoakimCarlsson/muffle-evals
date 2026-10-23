`HeaderMap::iter()` no longer reports a lower bound of 1 when it has 0 elements left. `iter_mut()` had the same bug, so I fixed both. The lib tests pass (143), and I didn't run the doc or integration tests.

`size_hint` counted the entry the iterator was on as still pending, even after that entry's last value had been yielded. In your example, `size_hint` read `(1, _)` just before the final `next()` returned `None`. The fix is in `src/header/map.rs`: the lower bound now drops that entry once it's finished. It uses `saturating_sub` so an empty map gives 0 instead of underflowing.

I added one test, `iter_size_hint_lower_bound_is_never_too_high`. It uses an empty map and a map with a multi-value key, and checks that `iter()` and `iter_mut()` never report a lower bound above what's left. It also checks they report 0 once exhausted.

I made no commit.
