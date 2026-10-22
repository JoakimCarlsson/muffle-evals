Running tests without `--all-features`; rkyv features conflict.

Done. `NaiveDateDaysIterator` and `NaiveDateWeeksIterator` now hold an inclusive front and back, and both ends stop when they meet. Your example now passes. `.len()` now counts the start and the last date, so it is one higher than before. The lib tests for `naive::date` and the `iter_` doctests pass. I couldn't run `--all-features` because the rkyv features conflict.

- **Behaviour change:** `.rev()` now starts from `NaiveDate::MAX` (weeks: the last whole-week step not past it), not from the start date. I rewrote the two doctests and the two limit tests to match.
- **Tests added:** `test_iterator_double_ended` covers your reversal case and the two ends meeting.
- **Skipped:** I didn't add a CHANGELOG entry.
