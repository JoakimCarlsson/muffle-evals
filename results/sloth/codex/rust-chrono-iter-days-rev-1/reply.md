I’ll check how both iterators define their range, then fix reverse traversal and add regression tests for reversed windows and date boundaries.

Both iterators currently move the same cursor in either direction, so reverse traversal leaves the range reported by `len()`. I’ll add a separate back boundary while preserving the existing forward range, including its exclusion of the final date or incomplete week. The reverse examples and tests also need updating because they currently expect traversal toward earlier dates.

The regression tests pass for reversed seven-item windows, mixed front/back traversal, exact lengths, and exhaustion at both date boundaries. The full test run hit three unrelated doctest failures caused by deprecated `std::i32::MAX` constants. I’ll finish with a targeted run covering the iterator tests and examples.

Fixed both iterators so front and back traversal share one range, lengths stay accurate, and iteration stops when the ends meet. Added regression tests and updated examples.

Validation: all 5 targeted unit tests and both iterator doctests pass. The full suite encountered 3 unrelated doctest failures involving deprecated `std::i32::MAX`.

Preserved existing forward endpoint behavior; no new APIs or dependencies.
