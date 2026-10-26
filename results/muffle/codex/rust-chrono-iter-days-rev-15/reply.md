I’ll check both iterators’ range handling, fix reverse iteration, and add regression tests for the reversed windows.

Both iterators move the same cursor backward in `next_back()`, which violates the shared-range contract. I’ll give them a remaining count so the ends meet, include the last representable date on each sequence, and update the examples that currently show the incorrect reverse behavior.

The fix passes all 292 library tests and both updated iterator examples. The new tests cover reversed windows, mixed front/back iteration, exact lengths, and exhaustion at the date limit. I also made `nth_back` skip directly to its result, so reversing a small window doesn’t walk through the full date range.

Fixed both iterators to consume the same range from either end, track their exact remaining length, and stop when the ends meet. Your reversed-window example now passes.

They also include the final representable date in their sequence. Documentation and regression tests were updated.

Validation: 292 library tests and both iterator doctests pass; no-default-features check passes. The full suite hits three unrelated existing doctest failures involving deprecated `std::i32::MAX`.
