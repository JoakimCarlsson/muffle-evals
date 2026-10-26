I’ll check how both iterators track their ranges, fix reverse iteration, and add regression tests for the windowed reversal.


Both iterators use one cursor: `next_back()` moves it toward the past, even though `len()` counts dates toward the future. I’ll track the number of remaining items so both ends consume the same range, preserving the current forward bounds. I’ll also update the examples that currently show `.rev()` walking backward from the start date.


The fix now makes both ends consume the same range and keeps `len()` accurate as they meet. The new tests cover seven-item reversals, mixed front/back iteration, exhaustion, and date boundaries. I also made reverse skipping constant time, since `.take(7).rev()` otherwise walks through the unused dates.


Unit and integration tests passed. The full run found three unrelated doctest failures from deprecated `core::i32::MAX` constants; both updated iterator examples passed. I’m finishing checks with default features disabled and the added reverse-skipping edge cases.


Fixed both iterators so forward and reverse iteration consume the same range, with accurate lengths and constant-time reverse skipping. Added regression tests and updated the examples.

Existing forward bounds are preserved: `iter_days()` excludes `NaiveDate::MAX`.

Validation passed: 292 default unit tests, 226 without default features, integration tests, and both iterator doctests. Three unrelated doctests fail on deprecated `core::i32::MAX` constants.
