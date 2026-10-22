I’ll check both iterators, fix their reverse traversal, and add regression tests for the windowed reversal.


Both iterators use the same cursor for forward and reverse traversal, so `next_back()` walks backward from the start instead of consuming the far end of the range. I’ll track the remaining length so both ends consume the same dates, preserving the existing forward behavior at `NaiveDate::MAX`.


The fix now makes both ends consume the same range, with regression coverage for reversed windows, mixed traversal, lengths, and exhaustion. The full doctest run also found three unrelated failures caused by deprecated APIs; I’m checking the two updated iterator examples separately.


Fixed both `iter_days` and `iter_weeks` so forward and reverse traversal consume the same range. Lengths now stay accurate when mixing both ends, and exhausted iterators remain exhausted. Existing forward boundary behavior is preserved.

Added regression tests and updated documentation examples.

Validation: all 293 unit tests and both iterator doctests pass. The full doctest suite has three unrelated failures involving deprecated APIs.
