I’ll check both iterators’ bounds and length calculations, fix their reverse behavior, and add regression tests for the reversed windows.

Both iterators use a single cursor, so `next_back()` moves it backward instead of consuming the end of the forward range. I’ll add a separate end bound and preserve the existing forward range, including its exclusion of `NaiveDate::MAX`. I’ll also update the examples to reverse a bounded window.

The regression tests pass, including mixed front/back iteration, exhaustion, and dates near both limits. The full test run hit three unrelated doctest failures caused by deprecated `std::i32::MAX` usage; I’m checking the updated iterator examples separately.

Fixed both iterators to consume the same range from either end, with accurate lengths and proper exhaustion. Your `take(7).rev()` example now passes.

Existing forward bounds are preserved, so `iter_days()` still excludes `NaiveDate::MAX`.

Validation: 292 library tests and both iterator doctests pass; formatting passes. The full suite encountered three unrelated doctest failures involving deprecated `std::i32::MAX` usage.
