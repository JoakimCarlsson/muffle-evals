Fix is in and the tests pass; I'm wrapping up with a quick summary.

`iter_days` and `iter_weeks` are now properly double-ended. Both ends work on one range, and your example passes. The changes are in `src/naive/date/mod.rs` and `src/naive/date/tests.rs`. The date unit tests (119) and the two `iter_` doctests pass. I only ran with default features, because `--all-features` doesn't compile here (`rkyv` has conflicting size features). Nothing is committed.

**Cause:** each iterator held a single `value`. `next` moved it forward and `next_back` moved the same value backward, so `.rev()` just walked away from the start in the opposite direction. `len()` still counted days up to `NaiveDate::MAX`.

**Fix:** each iterator now also stores how many dates remain. `next` takes from the front and `next_back` computes the last remaining date from the start plus that count. The ends stop when they meet, and `len()` matches what you can actually iterate.

**Behavior changes to be aware of:**
- **`NaiveDate::MAX` is now yielded.** `next_back()` on `iter_days()` returns `NaiveDate::MAX`, as you expected. To keep forward and backward iteration consistent, forward iteration now reaches `MAX` too. It used to stop one day short.
- **`iter_weeks` now includes the last in-range week.** For example, starting at 12 December of the max year it yields 3 dates, not 2.
- **`.rev()` no longer walks backward from the start date.** The old docs and tests relied on `date.iter_days().rev()` counting down from `date`. That is the behavior you reported, so I changed it.

I changed the existing limit tests to match (2 became 3). I also added tests for your example, for the ends meeting, and for the `MAX` edge. The two doc examples now show the reversed-window equivalence instead of the old backward walk.
