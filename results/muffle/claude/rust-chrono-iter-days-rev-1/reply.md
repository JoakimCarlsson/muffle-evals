Unit tests pass; checking which doctests failed, since the filter matched unrelated ones.

`iter_days` and `iter_weeks` are now double-ended, so your example passes and reversing a window gives the same dates as going forward. The new unit tests pass, and so do the `iter_days` and `iter_weeks` doctests. Three unrelated `checked_*_months` doctests fail, and they fail identically with my changes stashed.

**The cause:** each iterator held a single cursor. `next_back` walked backwards from the start date instead of working from the other end of the range, even though `len()` counted forward to `NaiveDate::MAX`.

**The fix:** both iterators now track the start date and how many dates remain. `next` and `next_back` each take from their own end and stop when they meet. `len()` and `size_hint` now agree with what the iterator yields. The changes are in `src/naive/date/mod.rs`.

**Behaviour changes:**
- `iter_days()` now includes `NaiveDate::MAX`, which it never yielded before. Without that, `next_back()` couldn't be `NaiveDate::MAX`, which is what you expected. Its `len()` is one larger as a result.
- `iter_weeks()` ends at the last date that is a whole number of weeks from the start and not past `MAX`.
- `.rev()` no longer walks backwards from the start date. It now starts from the far end of the range.
- I rewrote the `.rev()` examples in the `iter_days` and `iter_weeks` docs and the two `*_iterator_limit` tests, which relied on the old behaviour. For example, the day-limit test now expects 3 items from `MAX_YEAR-12-29`, not 2.
- I added `test_date_iterators_double_ended` in `src/naive/date/tests.rs`. It covers your reversed-window case for days and weeks, and the two ends meeting in the middle.

I didn't commit anything.
