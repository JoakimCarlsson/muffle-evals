I’ll check both iterators, fix their reverse behavior, and add regression tests for reversed windows and mixed front/back iteration.

Both iterators use one cursor for forward and backward iteration, so `next_back()` walks toward earlier dates instead of consuming the end of the forward range. I’ll give them a separate back boundary, preserve their current forward ranges, and update the examples to reverse a finite window.

Fixed both iterators to consume the same range from either end. Reversing `.take(7)` now matches reversing the collected dates, while existing forward ranges remain unchanged.

Added regression tests for reversed windows, mixed front/back iteration, lengths, and exhaustion; updated the documentation examples.

All unit and integration tests pass. Three unrelated doctests fail because they use deprecated `core::i32::MAX` constants with warnings denied.
