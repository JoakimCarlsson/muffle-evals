Running the tests now; the first attempt used conflicting cargo flags.

`iter_days` and `iter_weeks` now iterate over one shared range, and `.rev()` gives the reverse of the forward order. The `naive::date` unit tests and the two iterator doc tests pass. I did not run the full test suite.

Both iterators used to hold a single date, so `next_back` walked backward from the start date. They now track a front position and an end position, and the end starts at `NaiveDate::MAX`. Each end stops when the two meet. The changes are in `src/naive/date/mod.rs`.

Your example now passes. `start.iter_days().next_back()` returns `NaiveDate::MAX`, and `len()` matches what the iterator yields.

- **Behaviour change:** `iter_days().rev()` no longer counts down from the start date. It counts down from `NaiveDate::MAX`, so `start.iter_days().rev().take(n)` now gives the last `n` dates. To go backward from a date, use `take(n).rev()` on a forward iterator as in your example, or step with `pred_opt`.
- **`MAX` now included:** the old `next()` could never return `NaiveDate::MAX`. The range is now inclusive of it, so `len()` counts it too.
- **Weeks:** the last item is the final date that is a whole number of weeks after the start and not past `MAX`.

I updated the two doc examples that relied on the old reverse behaviour. I also rewrote the `*_iterator_limit` tests for the new counts and added `test_day_iterator_rev` and `test_week_iterator_rev`. These include your reproduction and a check that the two ends meet and stop.

Nothing is committed.
