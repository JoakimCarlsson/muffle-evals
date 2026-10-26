Now update the doc examples and tests.

`iter_days` and `iter_weeks` now keep one range for both ends, so your assertion passes. The new and updated tests and the two doc examples pass. I only ran the `naive::date` tests and the `iter_` doctests, not the full suite.

**The fix.** Each iterator now stores a `front` and a `back` (as days from CE), and it's empty once the front passes the back. The change is in `src/naive/date/mod.rs`.
- **Ends:** `front` starts at the start date, and `back` starts at `NaiveDate::MAX`.
- **Weeks:** `back` starts at the last `start + 7n` that doesn't pass `MAX`.
- **Length:** `len()` is now exact and matches the number of items you get. For weeks it used to undercount by one.
- **API:** `iter_days` and `iter_weeks` are still `const fn`.

**Behaviour changes you should know about:**
- `start.iter_days().rev()` now starts at `NaiveDate::MAX` and walks down to `start`. Before, it walked from `start` down to `MIN`. If you need the old walk toward `MIN`, build it from `pred_opt` or a `NaiveDate::MIN..=start` range.
- `MAX` itself is now yielded, which it wasn't before.
- The `Debug` output of the iterators changed, because the fields did.

**Tests and docs:**
- The two doc examples used the old `rev()` meaning, so I rewrote them to show the shared-range behaviour.
- I changed `test_day_iterator_limit` and `test_week_iterator_limit` to match the new counts, since they asserted the old limits.
- I added `test_iterator_rev_matches_forward`, which covers your reproduction, the `len()` check and the two ends meeting.
