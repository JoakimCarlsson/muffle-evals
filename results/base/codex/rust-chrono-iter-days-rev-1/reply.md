I’ll check how the day and week iterators track their range, fix reverse iteration, and add regression tests for reversed windows and mixed front/back iteration.


Both iterators use one cursor: `next()` moves it forward and `next_back()` moves it backward, while `len()` counts toward the maximum date. I’ll make both ends consume the same range, include the final representable step, and update the documentation examples to reverse a finite window.


Fixed both iterators to consume one shared range from either end, with accurate lengths and consistent exhaustion. Days now include `NaiveDate::MAX`; weeks include the last reachable date with the starting weekday. Reversing a taken window now works as expected.

Added regression tests and updated documentation examples.

Validation: 291 default and 225 no-default-feature unit tests passed. Both iterator doctests passed; three unrelated doctests failed on existing deprecated `core::i32::MAX` usage.
