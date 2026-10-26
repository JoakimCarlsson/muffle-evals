I fixed both iterators, so `.take(7).rev()` now gives the same dates as collecting forward and reversing. The `NaiveDate` unit tests pass, including a new double-ended test.

The full doctest run has 3 failures, in `checked_add_months` and `checked_sub_months`. They fail the same way with my changes stashed, so they aren't caused by this change.

**Cause:** the iterators stored only a start date. `next_back` therefore walked backwards from that same date, and `len()` counted forward to `NaiveDate::MAX`. The two ends were never on the same range.

**Fix:** in `src/naive/date/mod.rs`, both iterators now keep an upper bound that starts at `NaiveDate::MAX`. `next`, `next_back` and `len()` all use that one range, and `next_back` moves the bound inward. The two ends meet and stop without overlapping.

**`MAX` is excluded:** `next_back()` on a fresh `iter_days()` returns `NaiveDate::MAX.pred_opt()`, not `MAX` as you expected. Forward iteration has never yielded `MAX`, and `len()` and the existing limit test (`MAX_YEAR-12-29` yields 2 days) both rely on that. Including `MAX` would have changed that forward behaviour, so I kept the range as `[start, MAX)`. If you want `MAX` included, it's a small follow-up that changes `len()` and that existing test.

**Behaviour change:** `iter_days().rev()` used to walk backwards from the start date. It now starts at the far end of the range, which is what the `DoubleEndedIterator` contract requires. I rewrote the two doc examples and the `MIN_YEAR` reverse assertions in `test_day_iterator_limit` and `test_week_iterator_limit`, which relied on the old behaviour. Anyone who used `.rev()` to count backwards from a date will see different results.

I added `test_iterators_double_ended` in `src/naive/date/tests.rs`. It covers your example for days and weeks, and checks that the two ends meet without overlap.

I haven't committed anything.
