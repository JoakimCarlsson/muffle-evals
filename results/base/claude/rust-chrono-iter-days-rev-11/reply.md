Running the tests now; the first attempt used conflicting cargo flags.

I fixed it: `iter_days()` and `iter_weeks()` now keep one range with a front end and a back end, so your reproduction passes. Both iterators use the same range from the start date up to `NaiveDate::MAX`, and `next_back()` returns `NaiveDate::MAX` first, so `.take(7).rev()` matches collecting forward and reversing. The unit tests and the two `iter_` doctests pass. Three other doctests fail (`checked_sub_months`, `NaiveDateTime::checked_add_months` and `checked_sub_months`). They fail the same way with my changes stashed, so they're unrelated.

For weeks, the back end is the last date reachable in whole weeks from the start, not `MAX` itself.

Three behaviours changed:
- **`MAX` is now yielded.** Forward iteration used to stop before `NaiveDate::MAX`, so `len()` and `iter_days().last()` now include it.
- **`.rev()` on a fresh iterator starts at `MAX`.** It no longer walks backwards from the start date. Use `.take(n).rev()` to reverse a window.
- **Doc examples and one test changed.** The `.rev().take(4)` examples in the `iter_days` and `iter_weeks` docs relied on the old behaviour, so I rewrote them as `.take(4).rev()`. I also rewrote `test_day_iterator_limit` and `test_week_iterator_limit`, which encoded the old behaviour, and added `test_iterators_double_ended`, which covers your scenario for both iterators.

The changes are in `src/naive/date/mod.rs` and `src/naive/date/tests.rs`. Nothing is committed.
