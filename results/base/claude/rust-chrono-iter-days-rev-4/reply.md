I've fixed `iter_days` and `iter_weeks` so both ends of the iterator work on the same range. Your example now passes, and all 292 lib tests and the two iterator doctests pass. I didn't commit anything.

The old iterators stored only a front value, so `next_back` walked backwards from the start toward `MIN`. That is why `.rev()` gave you a single date near `MIN`. Each iterator now also has an end bound, starting at `NaiveDate::MAX`. `next` moves the front forward and `next_back` moves the end backward, and they stop when they meet. `len()` is computed from the same bounds, so it now agrees with what the iterator yields.

- **Behaviour change:** `.rev()` on an unbounded iterator now starts from the far end, not from the start date. The old backward-from-start behaviour was what the doc examples relied on. I changed those examples to `take(4).rev()`.
- **Tests:** I replaced the two old `.rev().take(4)` limit assertions with `.rev().count()` checks. I also added `test_iterators_double_ended`, which covers your example for days and weeks, mixed `next`/`next_back`, and `len()` consistency.
- **MAX not yielded:** `NaiveDate::MAX` is still never yielded, as before, even though `next_back` could now return it. `iter_days` yields start up to the day before `MAX`. `iter_weeks` yields only dates that have a following week still within range. That keeps the existing limit tests and `len()` numbers unchanged.

The changes are in `src/naive/date/mod.rs` and `src/naive/date/tests.rs`.
