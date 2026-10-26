I've rewritten both iterators so they track a front and a back bound. Next I'm updating the doc examples that relied on the old reverse behaviour, adding tests, and running them.

`NaiveDate::iter_days` and `iter_weeks` now handle reverse iteration correctly, and your repro assertion passes. The new and existing `naive::date` tests pass. Three doctests fail (`checked_sub_months`, `NaiveDateTime::checked_add_months` and `checked_sub_months`). They fail the same way with my changes stashed, so they aren't caused by this fix.

**Cause:** each iterator held only one date, and `next_back` walked backwards from that same date. The front and back never shared a range, so `.rev()` started at the start date and went towards `MIN`.

**Fix** (`src/naive/date/mod.rs`): both iterators now keep a front value and an exclusive back bound. Both ends work on the same range, and `len()` is the exact number of items left. They stop cleanly when the ends meet.
- **`iter_weeks`:** the back end lands on the last date that is a whole number of weeks from the start, which is also the last date forward iteration yields.
- **Constructors:** `iter_days` and `iter_weeks` are still `const fn`.

**`NaiveDate::MAX`:** `next_back()` on `start.iter_days()` returns the day *before* `NaiveDate::MAX`, not `MAX` itself. I kept this on purpose. Forward iteration has never yielded `MAX`, and `len()` and the existing limit tests (`MAX_YEAR-12-29` yields 2 dates) are built on that. So `len()` still matches the number of items. Including `MAX` would change that existing behaviour, so say if you want it.

**Doctests:** the doc examples for both methods used `.rev()` to walk backwards from a start date, which is the old behaviour. I replaced them with a "reverse a window" example like yours.

**Tests** (`src/naive/date/tests.rs`):
- Your repro, for days and for weeks.
- Front and back meeting in the middle.
- `len()` equal to the reversed count over the full range.
- Behaviour at `MAX`.

I didn't commit anything.
