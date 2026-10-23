Running the tests again; `--all-features` clashes with rkyv's size features, so I'm using the default features.

Doc tests were filtered out; running them too.

I fixed it. `iter_days` and `iter_weeks` now keep a front and a back end, so both ends work on the same range and stop when they meet. Your example now passes. The date tests and the two `iter_*` doc tests pass. I didn't run the rest of the suite, and `--all-features` doesn't build here because rkyv's `size_*` features conflict.

**Behaviour change:** `.rev()` used to walk backward from the start date, and the old docs and tests relied on that. It now starts at the end of the range, which matches the `DoubleEndedIterator` docs. If you want a backward walk from a date, use `successors` or an explicit loop. I rewrote the doc examples and the old `rev()` test cases to match.

**`NaiveDate::MAX` is still excluded.** The old forward iteration never yielded it, and `len()` already counted only the dates before it. So `start.iter_days().next_back()` is `NaiveDate::MAX.pred_opt()`, not `MAX`. Including `MAX` would need a different representation, so I left it out.

The change is in `src/naive/date/mod.rs`, with new cases in `test_day_iterator_limit` and `test_week_iterator_limit` in `src/naive/date/tests.rs`. They cover your reverse-equals-reversed-forward example, the meeting of both ends near `MAX_YEAR`, and exhaustion.

I haven't committed anything.
