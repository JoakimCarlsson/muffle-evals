Misplaced insertion (it split the doc comment); fix that.

`iter_days` and `iter_weeks` now work from both ends over the same range. The `naive::date` unit tests and the `iter_` doc-tests pass; I ran with `--features std,clock` because `--all-features` doesn't build here (rkyv's `size_16`/`size_32`/`size_64` features conflict). I didn't run the rest of the suite.

Each iterator now tracks how many items remain instead of just a cursor. That makes `len()` exact and lets `next_back()` return the true last item.

- **`iter_days`:** it covers `start..=NaiveDate::MAX`, so `next_back()` is `NaiveDate::MAX`. Your example now passes.
- **`iter_weeks`:** it covers `start, start+7, …` up to the last one not after `MAX`, and `next_back()` returns that last date.
- **`rev()` semantics:** `.rev()` on a fresh iterator used to walk backward from the start date. It now starts at the far end, which is what the `DoubleEndedIterator` contract requires. Use `.take(n).rev()` to walk the window backward.
- **`MAX` is yielded:** the old forward iteration silently dropped `MAX`, so `NaiveDate::MAX.iter_days()` now yields one item rather than none. `len()` is one higher than before.

I updated the two doc examples on `iter_days` and `iter_weeks` to use `.take(4).rev()`. I rewrote `test_day_iterator_limit` and `test_week_iterator_limit` to the new boundary counts. I also added `test_iterator_double_ended`, which covers your reverse-window case and the two ends meeting. The changes are in `src/naive/date/mod.rs` and `src/naive/date/tests.rs`, uncommitted.
