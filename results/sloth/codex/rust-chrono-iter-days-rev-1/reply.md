I’ll check how both iterators define their ranges and use those bounds to fix reverse iteration, then build and run the existing tests.

Both iterators use one cursor for two different directions, which violates the `DoubleEndedIterator` contract. I’ll track how many dates remain so both ends consume the same range, preserving the existing forward bounds.

The change reaches the two constructors and iterator implementations, their examples, and two existing boundary tests. Exports and configuration need no changes. Reverse iteration will change behavior: it will start at the end of the forward range instead of walking backward from the starting date.

The fix is in place and builds successfully. Both ends now share a remaining count, and reverse skipping is efficient for calls such as `take(7).rev()`.

The existing unit tests pass. The full test run hit three unrelated doctest failures caused by deprecated `std::i32::MAX` references; I’m checking the final run after the reverse-skipping change.

Fixed both iterators so forward and reverse iteration consume the same range, stop when they meet, and report the correct remaining length. `take(7).rev()` now works efficiently.

Updated the examples and existing boundary tests. Build and formatting checks pass, as do all unit and integration tests and both iterator doctests. Three unrelated doctests still fail on deprecated `std::i32::MAX` references.
