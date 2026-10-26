Now update doc examples and tests.

`iter_days` and `iter_weeks` now behave as proper double-ended iterators. Your reproduction passes, and the new and updated tests pass. I ran only the iterator unit tests and the two doc tests, not the full suite. The changes are in `src/naive/date/mod.rs` and `src/naive/date/tests.rs`.

Each iterator now tracks a front, a back and a finished flag. The front starts at the start date, and `next_back` starts at the last date the iterator can reach. They stop when they meet, so `take(n).rev()` works like `take(n)` reversed.

- **Days:** the range now runs from the start date to `NaiveDate::MAX` inclusive. `len()` includes `MAX`, so it is one higher than before, and `next_back()` returns `MAX`.
- **Weeks:** the last date is the start plus the largest whole number of weeks that doesn't pass `MAX`. `len()` and `next_back()` use that same date.

**Behaviour change:** `rev()` used to walk backwards from the start date towards `MIN`. It now starts at the far end of the range, so `start.iter_days().rev()` yields `NaiveDate::MAX` first. Anyone relying on the old direction will see different results.

**Updated tests and docs:** I updated the old limit tests, which asserted the old behaviour, and added a test for your reversed-window case and for the two ends meeting. I also reworded the `iter_days` and `iter_weeks` doc examples, which used the old `rev()` behaviour.
