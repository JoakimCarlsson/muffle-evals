Fixing a wrong `len` assertion I wrote (it should be 3), then rerunning the tests with default features.

Three doctests failed. I'll check whether any of them are mine.

`iter_days()` and `iter_weeks()` now iterate the same range from both ends. Your example passes: `start.iter_days().take(7).rev()` gives the same dates as collecting forward and reversing.

I haven't run your exact snippet, but `test_day_iterator_rev` does the same thing. The date tests pass (54), and so do the `iter_days` and `iter_weeks` doctests. Three other doctests fail: `checked_add_months` and `checked_sub_months` on `NaiveDate` and `NaiveDateTime`. They fail the same way with my changes stashed, on a deprecated `std::i32::MAX` error, so I left them alone.

**Cause:** each iterator held one date, and both `next` and `next_back` moved it. `.rev()` therefore walked backwards from the start date towards `NaiveDate::MIN`. `len()` instead counted forward to `MAX`.

**Fix (`src/naive/date/mod.rs`):** each iterator now stores its start date and the number of dates left. `next` takes from the front and `next_back` takes from the back, and they stop where they meet. `len()` and `size_hint` come from that count. `next_back()` on a fresh iterator is now `NaiveDate::MAX` for days, and the last representable weekly step for weeks.

**Behaviour changes:**
- **`MAX` is now included.** The old forward iteration stopped before `NaiveDate::MAX`, and `iter_weeks` likewise dropped its last representable date. This was needed so `len()` and `next_back()` agree. From `MAX_YEAR-12-29`, `iter_days` now yields 3 dates instead of 2. From `MAX_YEAR-12-12`, `iter_weeks` yields 3 instead of 2.
- **`.rev()` no longer counts down from the start.** The old doc examples and tests used it that way, for example `start.iter_days().rev().take(4)` counting down from `MIN`. Under your semantics that now yields dates counting down from `MAX`. I rewrote those examples and tests, and added tests that cover your case and the two ends meeting.

I didn't commit anything.
