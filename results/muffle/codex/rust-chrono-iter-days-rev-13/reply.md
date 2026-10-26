I’ll check both iterators, fix their reverse traversal, and add regression tests for reversed windows and mixed front/back iteration.

Both iterators use the same cursor for `next()` and `next_back()`, so reverse traversal walks backward from the start instead of consuming the far end of the range. I’ll preserve the existing forward range and track how many dates remain, with an efficient `nth_back()` so reversing a small `take()` window doesn’t scan millions of dates.

Fixed both iterators to consume the same range from either end, maintain accurate lengths, and stop when the ends meet. Added efficient reverse skipping, regression tests, and updated examples. Existing forward bounds are preserved.

Validation: 292 default and 226 no-default-feature unit tests pass. Doctests: 277 pass; three unrelated examples fail on deprecated `std::i32::MAX` usage.
