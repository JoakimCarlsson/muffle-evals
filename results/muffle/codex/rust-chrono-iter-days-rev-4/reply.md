I’ll check both iterators, fix their reverse traversal, and add regression tests for reversing a bounded window.

Both iterators currently use one cursor for two different ranges: `next()` moves toward the maximum date, while `next_back()` moves toward the minimum. I’ll make both ends consume the same range and preserve the existing forward endpoints, including the exclusion of `NaiveDate::MAX`. I’ll also update the reverse-iteration examples to match.

The fix now tracks how many dates remain, so front and back traversal stop when they meet. Regression tests cover reversed windows, mixed traversal, exhaustion, and weekly alignment near the maximum date. The library tests and documentation examples are still running.

Testing exposed a performance issue too: `take(7).rev()` uses `nth_back()` to skip the rest of the range. I’ve made that skip constant-time so reversing a small window doesn’t walk through millions of dates.

Fixed both iterators so front and back consume the same range, lengths stay accurate, and traversal stops when the ends meet. Reversing a bounded window now works efficiently.

Existing forward endpoints are preserved; documentation and regression tests were updated.

Validation: all 292 library tests and both iterator doctests pass. The full doctest suite has three unrelated failures involving deprecated `std::i32::MAX`.
