Fixed in `src/naive/date/mod.rs`. Reversing a window of `iter_days()` or `iter_weeks()` now gives the same dates as going forward, and the library and doc tests I ran pass.

**Cause:** each iterator stored only a single `value`. `next()` moved it forward and `next_back()` moved it backward from the same starting point. So `.rev()` walked back from the start date instead of from the far end. That is why your `take(7).rev()` returned `[-258092-07-28]`.

**Fix:** both iterators now keep a front position and an exclusive upper bound that starts at `NaiveDate::MAX`. `next()` advances the front and `next_back()` retreats the bound, so they stop when they meet. `len()` and `size_hint()` are computed from the remaining range. For weeks, `next_back()` returns the last whole-week step from the start, so both ends yield the same items.

**Behaviour change:** `iter_days().rev()` used to start at the start date and go backward. It now starts from the end of the range. This follows the `DoubleEndedIterator` contract, but it breaks any code that used `.rev()` to count backward from a date. The old behaviour is the same as `date.pred_opt()` stepping, or `(start - n)..start` reversed. I rewrote the two doc examples that relied on it to use `take(4).rev()`.

**`NaiveDate::MAX` stays excluded:** your report suggests `next_back()` should return `NaiveDate::MAX`. I kept the existing range, which stops just short of it. Forward iteration already excluded it and `len()` already counted it out, and a test expects `MAX_YEAR-12-29` to yield 2 days. `next_back()` therefore returns the day before `MAX`, and `len()` now matches the number of items. Including `MAX` is a small change if you want it, but `len()` and that test would change by one.

**Tests:** in `src/naive/date/tests.rs` I added your reverse-versus-forward case for days and weeks, plus tests that both ends meet correctly and that the iterator is empty at `MAX`. I also changed the two `.rev().take(4)` limit tests that tested the old behaviour. `cargo fmt --check` is clean.

I haven't committed anything.
