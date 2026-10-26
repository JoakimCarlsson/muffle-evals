I’ll check both iterators’ bounds and reverse traversal, fix the range semantics, and add regression tests for reversing a finite window.

Both iterators move the same cursor backward in `next_back()`, so reverse iteration leaves the range reported by `len()`. I’ll track the remaining range so both ends consume the same dates, preserve the existing forward bounds, and update the examples to reverse a finite window.

The fix passes the regression tests for reversed windows, mixed front/back iteration, and exhaustion near the upper bound. The full library suite also passed. The doctest run found three unrelated failures involving deprecated `std::i32::MAX` usage; I’m checking the updated iterator examples separately.

Fixed both iterators so forward and reverse traversal consume the same range, with accurate lengths and consistent exhaustion. Existing forward bounds are preserved.

Added regression tests and updated documentation examples.

Validation: all 292 library tests and both iterator doctests pass. The full doctest suite has three unrelated failures from deprecated `std::i32::MAX` usage.
