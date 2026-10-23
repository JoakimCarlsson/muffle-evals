I’ll check how both iterators define their ranges, fix reverse traversal, and add regression coverage for the example and date boundaries.

Both iterators currently move the same date backward in `next_back()`, so reverse traversal leaves the range reported by `len()`. I’ll give each iterator a separate back boundary while preserving its existing forward range, including its upper-limit behavior.

The change reaches the two constructors, iterator implementations, documentation examples, and existing iterator tests. Exports and configuration need no changes. Direct `.rev()` calls will now traverse the forward range from its far end.

The fix passes all 292 unit tests, including the seven-date example, mixed front/back consumption, and exhaustion checks for both iterators. The build without default features also passes. The full test run is still working through the integration tests.

Fixed both iterators to track separate front and back boundaries. Reversing a taken window now produces the expected dates, and mixed-direction iteration stops when the ends meet. Existing forward ranges are preserved.

Added regression tests and updated documentation examples.

Validation: all 292 unit tests, integration tests, and the build without default features pass. Both iterator doctests pass; three unrelated doctests fail because they use deprecated `core::i32::MAX`.
