Unit tests pass. I'm checking whether the doc-test failures come from my change or were already there.

I fixed both iterators, and your example now passes. The 293 unit tests and the `iter_days` and `iter_weeks` doc tests pass. Three other doc tests fail (`checked_sub_months` and `checked_add_months` variants) because of a deprecated `i32::MAX` use. They fail the same way without my change.

**Cause:** the iterators only stored the front position. `next_back` walked backward from the start date, and `len()` counted forward to `NaiveDate::MAX`. So the two ends never described the same range.

**Fix** (in `src/naive/date/mod.rs`): each iterator now stores the front date and a count of dates remaining. The back end is derived from that count, so both ends work on one range and stop when they meet.
- `iter_days` runs from the start date to `NaiveDate::MAX`. `next_back()` now returns `NaiveDate::MAX`.
- `iter_weeks` runs in 7-day steps from the start date up to the last date at or before `NaiveDate::MAX`. `next_back()` returns that date.
- `len()` now matches what iteration actually yields.

**Behaviour changes:**
- **`.rev()` direction:** `start.iter_days().rev()` used to walk backward from `start`. It now starts at `NaiveDate::MAX`. This follows from the semantics you asked for, but code relying on the old behaviour will break.
- **`NaiveDate::MAX` is now yielded:** the old forward iteration stopped one date short of it, so it is a new item. For example, `iter_days` from `MAX_YEAR-12-29` now yields 3 dates instead of 2.

**Tests and docs:**
- I rewrote the doc examples, which used the old backward-walk `.rev()`. They now check `take(n).rev()` against the reversed forward sequence.
- I rewrote the limit tests for the new counts.
- I added double-ended tests in `src/naive/date/tests.rs`. They cover your reproduction for days and weeks, and both ends meeting.

I didn't commit anything.
