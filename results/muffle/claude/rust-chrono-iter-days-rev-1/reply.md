`iter_days` and `iter_weeks` now iterate both ends over the same range, so your example passes. The new and existing date tests and the two iterator doctests pass. I didn't run the full test suite.

Both iterators now cover the inclusive range from the start date to `NaiveDate::MAX` and stop when the two ends meet. The changes are in `src/naive/date/mod.rs`, plus tests in `src/naive/date/tests.rs`.

- **`next_back()`:** it now returns `NaiveDate::MAX` for days. For weeks it returns the last date reachable from the start in whole weeks. `len()` agrees with what iteration actually yields.
- **`iter_days().rev()`:** `.rev()` used to walk backwards from the start date. It now starts at `NaiveDate::MAX`. The old behaviour is gone, not just changed. To go backwards from a date, use `.take(n).rev()`, or `.rev()` from the end of a window.
- **`NaiveDate::MAX`:** it is now yielded. Before, `next()` stopped one date short of it. At `MAX_YEAR-12-29`, `iter_days().take(4).count()` is now 3, not 2. `iter_weeks` shows the same change.

I added a private `end` field to both iterator structs. Their derived `PartialEq` and `Hash` now include it, and exhausted iterators are normalized so they compare equal. `iter_days` and `iter_weeks` are still `const fn`.

I updated the `iter_days` and `iter_weeks` doc examples and the two `*_iterator_limit` tests to the new semantics. I added `test_iterators_double_ended`, which covers your example, both ends meeting, and `MAX` as the start.
