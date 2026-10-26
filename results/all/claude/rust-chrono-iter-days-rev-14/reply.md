Done. Both iterators now track a remaining count, so `.rev()` starts at the far end (`NaiveDate::MAX` for days) and the two ends stop where they meet. I did not run the whole test suite, only the iterator unit tests and doctests, which pass.

Behaviour changes:
- `iter_days().rev()` and `iter_weeks().rev()` no longer walk backward from the start date. The `iter_days` and `iter_weeks` doc examples relied on that, so I rewrote them.
- `NaiveDate::MAX` is now yielded, so `len()` is one higher than before. `iter_weeks` yields up to the last whole-week step at or before `MAX`.

I rewrote the two limit tests to match and added a rev test for each iterator, including your repro. The changes are in `src/naive/date/mod.rs` and `src/naive/date/tests.rs`.
