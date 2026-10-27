Done. `iter_days` and `iter_weeks` now keep a front and an end, so both ends walk the same range and `.take(7).rev()` matches your forward-then-reverse result. Tests and doctests for both iterators pass; I did not run the full suite.

- **`NaiveDate::MAX` still not yielded:** forward iteration already stopped before it, and the existing limit test relies on that. `len()` is unchanged, and `next_back()` returns `MAX - 1` for `iter_days`. Including `MAX` is a small change, but it would alter `len()` and that test.
- **Changed `.rev()` behaviour:** `.rev()` now starts from the end of the range instead of walking backward from the start date. I rewrote the two doctests and the two `.rev()` limit tests to match.
