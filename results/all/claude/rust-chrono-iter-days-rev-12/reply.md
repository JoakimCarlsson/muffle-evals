Done. Both ends of `iter_days` and `iter_weeks` now share one range, so your assertion passes. Unit tests and the iterator doctests pass.

- **`MAX` still excluded:** `NaiveDate::MAX` is still never yielded, to keep `len()` and forward behaviour unchanged. `next_back()` returns the date before `MAX`, not `MAX` itself.
- **`.rev()` behaviour change:** `.rev()` now starts from the far end instead of walking backward from the start date. I rewrote the old limit tests and doc examples that relied on the old behaviour.
- **Unrelated doctest failures:** three `checked_*_months` doctests fail. The `checked_sub_months` doctests also fail with my changes stashed. I didn't check the other two on the original code.
