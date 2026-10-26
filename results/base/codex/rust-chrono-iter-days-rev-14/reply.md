I’ll check both iterators, fix their reverse traversal, and add regression tests for the `take(...).rev()` case.

Both iterators use one cursor, so `next_back()` walks backward from the start instead of consuming the far end of the range. I’ll track the remaining range and include the final representable date. I’ll also make skipping efficient so `take(7).rev()` doesn’t have to traverse millions of dates.

The regression tests pass, including mixed front/back iteration and boundary cases. The full test run found three unrelated doctest failures caused by deprecated `core::i32::MAX` constants; both updated iterator examples passed. I’m finishing the checks with default features disabled.

Fixed both iterators. Forward and reverse iteration now consume the same range, so `take(7).rev()` returns the expected dates. Skipping is constant time, lengths remain accurate, and the final representable day or week is included.

Added regression tests and updated documentation examples. Unit tests, integration tests, and iterator doctests pass, including tests without default features. The full doctest suite has three unrelated failures from deprecated `core::i32::MAX` usage.
