Lib tests pass. I'm now checking whether the two doctest failures were already there, and that the `iter_*` doctests pass.

`iter_days` and `iter_weeks` now treat both ends as one shared range, so your example passes: `start.iter_days().take(7).rev()` matches reversing the forward window. Both iterators also stop when the two ends meet. The lib tests, including the new ones, and the `iter_days`/`iter_weeks` doctests pass.

Three `checked_*_months` doctests fail with or without my change, so they're unrelated. I didn't run the rest of the suite against the baseline.

- **Cause:** each iterator kept a single cursor, so `next_back` just walked backwards from the start date. That's why your `rev()` ran off toward the minimum date, while `len()` counted forward to `NaiveDate::MAX`.
- **Fix:** each iterator now holds an inclusive start and end, and the end begins at `NaiveDate::MAX`. `next_back()` therefore returns `MAX` first, and `len()` agrees with what you can actually pull out. The change is in `src/naive/date/mod.rs`.
- **Weeks:** the end is the last date reachable from the start in whole weeks without passing `MAX`.

This changes behaviour in two ways:
- **`MAX` is now yielded.** The old forward iterators never returned `NaiveDate::MAX` (or, for weeks, the last whole-week date), so counts near the limit go up by one. I updated `test_day_iterator_limit` and `test_week_iterator_limit` to match.
- **`.rev()` no longer walks backward from the start date.** It now starts from the far end. The old `.rev()` doc examples relied on that, so I rewrote them to show the `MAX` end and the window-reversal property.

`iter_weeks` is no longer a `const fn`, because it has to compute the last date. If you'd rather keep it `const`, say so and I'll look at it.

I added `test_day_iterator_double_ended` and `test_week_iterator_double_ended`, which cover your case and the ends meeting. I didn't commit anything.
