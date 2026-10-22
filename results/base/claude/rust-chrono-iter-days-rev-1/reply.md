Unit tests pass; I'm checking which 3 doctests failed and whether my change caused them.

`iter_days()` and `iter_weeks()` now work from both ends over the same range, so your reproduction passes. I added a regression test for it. The new tests and the other `naive::date` unit tests pass. Three doctests fail (`checked_sub_months` in `date`, and `checked_add_months` and `checked_sub_months` in `datetime`). The same three fail with my changes stashed, so they aren't caused by this fix.

**What was wrong:** the iterators kept a single cursor, so `next_back` just walked backwards from the start date. It never touched the far end, which is why `len()` and `next_back()` disagreed.

**The change** (`src/naive/date/mod.rs`): each iterator now stores its start date and the number of items left. `next` takes from the front and `next_back` takes from the back, and they stop when they meet. `len()` now matches what `next` actually produces. `next_back()` is `NaiveDate::MAX` for `iter_days()`, and the last whole-week date for `iter_weeks()`.

**Behaviour changes:**
- `iter_days()` now includes `NaiveDate::MAX`. Before, `next()` never yielded it, and `len()` was one too low.
- `iter_weeks()` now includes its last reachable date. Before, it dropped one item for the same reason.
- `.rev()` no longer walks backwards from the start date towards `MIN`. A reversed iterator now yields the same dates as the forward one, in reverse order. Anything relying on the old walk-backwards behaviour will break.
- I rewrote the `iter_days` and `iter_weeks` doc examples to match the new behaviour.
- I updated `test_day_iterator_limit` and `test_week_iterator_limit` for the inclusive end, so their expected counts went from 2 to 3. I also added `test_iterator_double_ended`.

I haven't committed anything.
