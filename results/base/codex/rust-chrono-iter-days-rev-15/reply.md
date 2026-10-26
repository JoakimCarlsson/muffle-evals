I’ll check how the day and week iterators define their ranges, fix reverse iteration, and add regression tests for reversed windows.

Both iterators currently use one cursor for both ends, so `next_back()` walks backward from the start instead of consuming the end of the forward range. I’ll track the remaining range, include the final representable step, and update the docs and tests to match.

The fix passes all 290 library tests, including reversed windows, mixed front/back consumption, and exhaustion at the date limits. The full doctest run hit three unrelated failures caused by deprecated `core::i32::MAX` references; I’m checking the iterator examples and no-default-features build separately.

Fixed both iterators so forward and reverse iteration consume the same range and stop when they meet. Day iteration now includes `NaiveDate::MAX`; week iteration includes the last representable date on the starting weekday.

Added regression tests and updated examples. All 290 library tests, both iterator doctests, formatting checks, and the no-default-features build pass.

The full doctest suite has three unrelated failures involving deprecated `core::i32::MAX` references.
