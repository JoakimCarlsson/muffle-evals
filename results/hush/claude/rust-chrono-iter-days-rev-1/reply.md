Done. Both iterators now track a shared remaining count, so `next_back` ends the same range `next` walks and the two ends meet. The two iterator unit tests and the two doctests pass. I didn't run the full suite.

`.rev()` on its own now starts at the far end of the range, just below `NaiveDate::MAX`, instead of walking backwards from the start date. I rewrote the `iter_days` and `iter_weeks` doc examples and the limit tests to match. The range still excludes `NaiveDate::MAX`, as `next` always did, so `start.iter_days().next_back()` is `NaiveDate::MAX.pred_opt()`, not `MAX`.
