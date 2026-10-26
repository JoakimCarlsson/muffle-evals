Running the tests now: the iterator rewrite and test updates are in, and I still need to run the lib and doc tests.

`iter_days` and `iter_weeks` now behave the same in both directions. Your example passes, and I added it as a test. The `naive::date` lib tests and the two doc-tests pass. I didn't run the rest of the crate's tests.

**Cause:** each iterator kept a single `value`. `next` moved it forward and `next_back` moved it backward, so the two ends never shared a range. `rev()` therefore started at `start` and walked toward `MIN`, while `len()` counted forward to `MAX`.

**Fix** (`src/naive/date/mod.rs`): each iterator now holds an inclusive `front` and `back`, and stops when they meet.
- **`iter_days`:** the range is `start..=NaiveDate::MAX`.
- **`iter_weeks`:** `back` is the last `start + 7k` that is still representable. `iter_weeks()` computes it using only `const` helpers, so it stays a `const fn`.
- **Length:** `len()` and `size_hint` now match what the iterator yields, with no off-by-one.

**Behaviour changes you may want to flag:**
- `NaiveDate::MAX` is now yielded. Previously it never was, because `next` stopped before it.
- `start.iter_days().rev()` now starts at `MAX`, not at `start` going backwards. Any caller that relied on walking backward from `start` will break. For example, `d.iter_days().rev().take(4)` used to give the 4 days up to and including `d`. To get that, use `d.iter_days().take(4).rev()` for the days after `d`, or `d.pred_opt()` in a loop for the days before it.
- I rewrote the two doc examples that used the old pattern, and the two limit tests that assumed the old edge behaviour (their expected counts went from 2 to 3 at the top end).

I didn't touch `CHANGELOG.md` and haven't committed anything.
