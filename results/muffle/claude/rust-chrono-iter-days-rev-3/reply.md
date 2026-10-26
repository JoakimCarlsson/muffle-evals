Unit tests pass. Three doctests failed, so I'm checking which ones and whether I caused them.

`iter_days` and `iter_weeks` are now properly double-ended, so your reproduction passes: the reversed window equals the forward window reversed. The 292 lib tests pass. In the `naive::date` doctest run, 3 doctests fail, but none are the iterator ones. They are `checked_sub_months`, `NaiveDateTime::checked_add_months` and `NaiveDateTime::checked_sub_months`. They fail on a deprecated `std::i32::MAX` in code I didn't touch, so they look like they were already failing. I didn't confirm that on a clean checkout.

**What changed** (`src/naive/date/mod.rs`)
- Both iterators used to hold a single date, so `next` walked up and `next_back` walked down from the same start. That is why `.rev()` gave `[-258092-07-28]`.
- They now track how many dates remain between the start and `NaiveDate::MAX`. `next` takes from the front, `next_back` takes from the back, and they stop when they meet.
- `len()` and `size_hint()` now equal the number of items the iterator will actually yield.

**Behaviour changes to be aware of**
- `iter_days().next_back()` is now `NaiveDate::MAX`. Before, `.rev()` counted down from the start date.
- `NaiveDate::MAX` is now yielded by `iter_days`. It was previously dropped. Starting at `MAX_YEAR-12-29` and taking 4 now gives 3 dates instead of 2.
- `iter_weeks` yields one more date at the upper edge as well, for example 3 instead of 2 from `MAX_YEAR-12-12`.
- The old `.rev()` doc examples relied on the old backwards-walk behaviour, so I replaced them with examples of the new one.

**Tests** (`src/naive/date/tests.rs`)
- I updated the two existing limit tests for the new counts.
- I added `test_iterators_double_ended`. It covers your window-reversal case for days and weeks, `next_back` being `MAX`, both ends meeting, and `len` shrinking correctly.

I haven't committed anything.
