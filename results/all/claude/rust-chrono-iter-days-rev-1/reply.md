Doc examples need rewriting: rev now starts from MAX.

Done. `iter_days`/`iter_weeks` now track a remaining count; `next_back` starts at the true end (`NaiveDate::MAX` for days) and both ends meet.

Behavior changes:
- `.rev()` without `take` now starts from the end, not walking back toward `MIN`.
- `NaiveDate::MAX` is now yielded, so limit tests went 2→3.
- Doc examples and limit tests were updated, and I added `test_iterator_double_ended`.

Lib `naive::date` tests and iterator doctests pass. `--all-features` fails on an rkyv feature conflict, so it was not run.
