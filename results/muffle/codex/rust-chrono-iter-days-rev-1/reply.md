I’ll check both iterators, fix their reverse traversal, and add regression tests for reversing a finite window.

Both iterators move a single cursor backward, which makes `next_back()` disagree with their reported length. I’ll track the remaining range so the two ends meet correctly, including the final representable date (or final aligned week). I’ll also update the examples that currently show `.rev()` walking backward from the starting date.

Fixed both iterators so forward and reverse traversal consume the same range, with accurate lengths and proper exhaustion. Your example now passes.

The range includes `NaiveDate::MAX` for days and the final matching weekday for weeks. Updated examples and added regression tests.

Validation: 290 unit tests pass; formatting and no-default-features checks pass. Three unrelated doctests fail on deprecated `std::i32::MAX` usage.
