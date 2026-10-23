I’ll check the day and week iterators, fix their reverse traversal, and add regression tests for bounded reversal and mixed forward/backward iteration.

Both iterators currently use the same date as a cursor in either direction, so reversing walks into a different range. I’ll track the remaining range explicitly, include the final representable date on each iterator’s step sequence, and make skipping efficient so `.take(7).rev()` doesn’t walk through millions of dates.

The fix passes all 290 unit tests, including the new regression tests. Those tests also pass with default features disabled. The iterators now report the correct remaining length and stop when forward and backward traversal meet; documentation and integration tests are still running.

Fixed both iterators to traverse the same range from either end. Your assertion now passes.

Lengths are accurate, endpoints are included, and mixed forward/backward iteration stops correctly. Added regression tests and updated documentation.

All unit and integration tests pass. Three unrelated doctests fail because existing deprecated constants trigger `deny(warnings)`.
