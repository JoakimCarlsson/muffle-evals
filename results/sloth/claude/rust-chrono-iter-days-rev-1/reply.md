Builds. Now updating the doc examples and tests that relied on the old cursor-style `rev()`.

`NaiveDate::iter_days` and `iter_weeks` now iterate correctly from both ends. Your example passes: `start.iter_days().take(7).rev()` gives the same dates as collecting forward and reversing. The unit tests pass (292), but three doctests fail: `checked_sub_months`, and `checked_add_months` and `checked_sub_months` on `NaiveDateTime`. They fail on a deprecated `std::i32::MAX` and don't touch the iterators. I didn't run with `--all-features`, because that build fails on mutually exclusive `rkyv` size features.

**Cause:** each iterator was a single cursor. `next` moved it up and `next_back` moved it down from the same date, so `.rev()` walked towards `NaiveDate::MIN`. That also explains the `[-258092-07-28]` in your output.

**Fix (`src/naive/date/mod.rs`):** each iterator now stores its start date and how many dates remain up to `NaiveDate::MAX`. `next` and `next_back` each take from their own end and stop when the two meet. `len()` is exact and matches what you actually get.

**Behaviour changes:**
- `iter_days` now yields `NaiveDate::MAX` and `len()` is one higher. Before, it never yielded `MAX`.
- `iter_weeks` now yields the last date reachable in 7-day steps from the start. It also counts one more date than before.
- `.rev()` on its own now starts at the far end, so `date.iter_days().rev()` begins at `NaiveDate::MAX`. Code that used `.rev()` to walk backwards from `date` must now use `.take(n).rev()`.

I changed the `iter_days` and `iter_weeks` doc examples to use `.take(4).rev()`. I replaced the old limit tests with new ones, and added a test that reverse matches forward for days, weeks and the `MAX` boundary.
