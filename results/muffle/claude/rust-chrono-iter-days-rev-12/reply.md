Running the tests now; my first test command had conflicting flags, so I'm splitting it into lib and doc runs.

`iter_days()` and `iter_weeks()` now iterate the same range from both ends, so your reproduction passes. The new tests and the two updated doc tests pass, and `cargo fmt --check` is clean. I didn't run the full test suite. `--all-features` doesn't build here because `rkyv`'s `size_32` and `size_64` features clash, so I ran with default features.

**Cause:** Each iterator stored only one `value`. `next()` moved it forward and `next_back()` moved the same value backward. So `.rev()` walked backward from the start date (and ended at `NaiveDate::MIN`), while `len()` counted forward to `MAX`.

**Fix (`src/naive/date/mod.rs`):** Each iterator now keeps a front date, a back date and a `done` flag, and stops when the two ends meet.
- **`iter_days`:** The range runs from the start date to `NaiveDate::MAX`.
- **`iter_weeks`:** The range runs from the start date to the last date that is a whole number of weeks after it and not past `MAX`.
- **`len()`:** It now matches what the iterator actually yields.
- **`const`:** `iter_days` and `iter_weeks` are still `const fn`.

**Behaviour changes:**
- **`MAX` is now yielded.** The old forward iteration never returned `NaiveDate::MAX`. I included it, since the iterator is meant to cover all representable dates. This is why `test_day_iterator_limit` and `test_week_iterator_limit` now expect 3 items near the end instead of 2.
- **`.rev()` no longer walks backward from the start date.** The old docs showed `iter_days().rev()` from 2016-03-01 going back in time, and the old limit tests relied on it. That is now `next_back()` of the same forward range. I replaced those doc examples and rewrote the limit tests. To go backward from a date, use something like `(0..n).map(|i| d - Days::new(i))`.

I added `test_iterator_double_ended`. It covers your reproduction for both iterators, and checks that `next_back()` returns `MAX` for days and a date a whole number of weeks from the start for weeks. It also checks that the ends meet without overlapping and that `len()` is correct.

I haven't committed anything.
