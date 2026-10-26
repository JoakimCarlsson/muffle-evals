Fixing the old tests, which assumed the old reverse semantics, and adding new ones.

`iter_days` and `iter_weeks` now work as double-ended iterators, and your example assertion passes. The new unit tests and the updated doctests pass. I didn't run the rest of the test suite.

**What was wrong:** Each iterator stored a single date. `next_back` walked backward from the start date instead of coming in from the far end, while `len()` counted forward to `NaiveDate::MAX`. That is why `.take(7).rev()` produced a garbage result.

**What changed:** Both iterators in `src/naive/date/mod.rs` now track the front and the back of one range, and they stop when the two ends meet.
- **`iter_days`:** it covers every date from the start through `NaiveDate::MAX`, so `next_back()` returns `NaiveDate::MAX`.
- **`iter_weeks`:** the back end is the last date a whole number of weeks after the start that still fits. `len()` and `size_hint` are exact for both.

**Behaviour changes beyond your report:**
- **`NaiveDate::MAX` is now yielded.** Before, `iter_days` stopped one date short of it. For example, from 9999-12-29 (the `MAX_YEAR` case in the tests) it now yields three dates instead of two, and `len()` is one higher than before. I took your statement that `next_back` should be `NaiveDate::MAX` as the intended range.
- **`.rev()` now means something different.** `start.iter_days().rev()` used to count backward from `start`. It now starts at `NaiveDate::MAX`. To count backward from a date, use something like `start.iter_days().take(n).rev()`, or step with `pred_opt`.

I rewrote the `iter_days` and `iter_weeks` doctests because they relied on the old `.rev()` behaviour. I also replaced the old limit tests in `src/naive/date/tests.rs` and added tests for your reproduction, the meeting of the two ends, and the week alignment.

I haven't committed anything.
