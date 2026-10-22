I’ll check how the day and week iterators define their ranges, fix reverse iteration, and add regression tests for both.

Both iterators currently use reverse iteration to move backward from the start date. I’ll make both ends consume the same finite range, include the last reachable date, and update the examples to show reversing a taken window.

Fixed both iterators so forward and reverse iteration consume the same range. Days now include `NaiveDate::MAX`; weeks include the last reachable date with the starting weekday.

Added regression coverage for reversed windows, mixed iteration, lengths, boundaries, and exhaustion. Updated the examples.

Validation passed: 290 library tests, 224 without default features, formatting, and both iterator doctests. The full doctest run had three unrelated failures involving deprecated `std::i32::MAX`.
