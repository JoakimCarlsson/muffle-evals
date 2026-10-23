Fix is in and tests pass; I'm doing a last check that the whole library builds and passes.

`iter_days` and `iter_weeks` now work as proper double-ended iterators, and your example passes. The full lib test suite (293 tests), the two `iter_*` doc tests and clippy all pass. I haven't committed anything.

**Cause:** the iterator only stored its current date. `next_back` walked backwards from that same date instead of starting at the far end. `len()` was counting towards `NaiveDate::MAX` while `next_back` ignored it.

**Fix (`src/naive/date/mod.rs`):** both iterators now hold an inclusive front and back plus a `done` flag. Forward and backward iteration share one range and stop when they meet.
- **`iter_days`:** the range is `start..=NaiveDate::MAX`, so `next_back()` returns `NaiveDate::MAX` first.
- **`iter_weeks`:** the back end is the last start-plus-N-weeks date that doesn't pass `MAX`.
- **`len()`:** it now matches what iteration actually yields.

**Behaviour changes:**
- **`MAX` is now yielded:** the old forward iteration silently dropped `NaiveDate::MAX` for days, and the last in-range week date for weeks. So `NaiveDate::from_ymd_opt(MAX_YEAR, 12, 29).iter_days().take(4)` now gives 3 items, not 2.
- **`rev()` semantics:** `date.iter_days().rev()` used to walk backwards from `date`. It now starts from `MAX`. To go backwards from a date, use `take(n).rev()` as in your example.
- **Docs and tests:** I updated the doc examples on `iter_days` and `iter_weeks` that relied on the old `rev()` behaviour. I also changed `test_day_iterator_limit` and `test_week_iterator_limit` to the new counts, and added `test_day_iterator_rev` and `test_week_iterator_rev`. They cover your reproduction, front and back meeting, and the `MAX` edge cases.
