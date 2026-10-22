Done. Both iterators now keep a front and an end, so the reversed window matches the forward one. The new tests and the lib tests pass.

- **Behaviour change:** `.rev()` now walks back from `NaiveDate::MAX`, not from the start date. The old `iter_days` and `iter_weeks` doc examples relied on that, so I rewrote them.
- **Last date:** `next_back` now returns `NaiveDate::MAX`. It was never returned before.
- **Length:** `iter_days().len()` now counts `MAX` and is one higher than before.
- **Existing limit tests:** I updated them because the counts near `MAX` changed.
- **Doc-tests:** Three doc-tests fail (`checked_sub_months`, `NaiveDateTime::checked_add_months` and `checked_sub_months`). They fail the same way without my change, on a deprecated `i32::MAX`.
