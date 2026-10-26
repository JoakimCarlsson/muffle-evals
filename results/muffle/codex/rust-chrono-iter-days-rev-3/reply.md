I’ll check both iterators’ bounds, fix reverse traversal, and add regression tests for reversed windows and mixed forward/backward iteration.

Both iterators use one cursor for both ends, so `next_back()` walks toward earlier dates instead of consuming the remaining forward range. I’ll give them separate front and back bounds and preserve their existing forward limits. I’ll also update the examples that currently use `.rev()` to walk backward from the starting date.

The fix passes all 294 unit/integration tests and all 225 tests with default features disabled. Three unrelated doctests fail on deprecated `std::i32::MAX` references; I’m checking the updated iterator examples separately.

Fixed both iterators to track separate front and back bounds. Reverse traversal now consumes the same range as forward traversal, lengths stay accurate, and both ends stop when they meet. Existing forward limits are preserved.

Added regression tests and updated documentation examples.

Validation: 294 unit/integration tests, 225 tests without default features, and both iterator doctests pass. Three unrelated doctests fail because of deprecated `std::i32::MAX` references.
