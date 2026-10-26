I’ll check both iterators, fix their reverse behavior, and add regression tests for the example.

Both iterators use a single cursor, so `next_back()` walks backward from the start instead of consuming the far end. I’ll give each iterator a shared remaining range, include the final representable step, and update the examples to reverse a bounded window.

The fix passes all 292 library tests, including the reverse-window regression and checks for endpoint handling, exact lengths, and exhaustion from both ends. The doctest run passed 277 tests but failed three unrelated examples because this compiler rejects their deprecated `std::i32::MAX` usage. I’ll verify the two updated examples separately.

Fixed `iter_days` and `iter_weeks` so both ends consume the same range, lengths stay accurate, and iteration stops when the ends meet. The final representable step is now included.

Added regression tests and updated documentation.

Validation: 292 library tests, both updated doctests, and the no-default-features check passed. Three unrelated doctests fail on deprecated `std::i32::MAX` usage.
