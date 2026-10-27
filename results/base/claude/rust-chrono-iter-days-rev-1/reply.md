Now update doc examples and tests to the new semantics.

`iter_days` and `iter_weeks` now work from both ends over one range, so your example passes. The `naive::date` unit tests, the two iterator doc tests and `cargo fmt --check` all pass. I didn't run the full test suite or clippy.

**Cause:** each iterator only stored its current date. `next()` stepped forward and `next_back()` stepped backward from the same date, so `.rev()` walked towards `NaiveDate::MIN` instead of back from the far end. That is why `.take(7).rev()` gave a different result than reversing `.take(7)`.

**Fix** (`src/naive/date/mod.rs`): each iterator now also stores how many items are left.
- **Range and ends:** the range runs from the start date to `NaiveDate::MAX` inclusive. `next_back()` yields `NaiveDate::MAX` (or the last date reachable in whole weeks, for `iter_weeks`), and the two ends stop when they meet.
- **`len()`:** it now matches the number of items actually yielded.

**Behaviour changes:**
- `iter_days` now includes `NaiveDate::MAX`, which the old forward iteration never produced. `iter_weeks` likewise now includes its last reachable date. The old limit tests counted 2 items near the end; they now count 3.
- `.rev()` on a fresh iterator now starts at the far end instead of walking backwards from the start date. The doc examples relied on the old behaviour, so I rewrote them.

I replaced the old limit tests and added new ones in `src/naive/date/tests.rs`, including your reverse-window case and the two ends meeting in the middle.
