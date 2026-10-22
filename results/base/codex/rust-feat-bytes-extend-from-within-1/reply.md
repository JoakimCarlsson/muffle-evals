I’ll check how `BytesMut` handles growth and ranges, then add the method and tests for bounds and allocation behavior.

The method is implemented. It validates the range before reserving space, then copies using pointers obtained after any buffer movement. The tests cover range forms, invalid bounds, growth, and buffers with split storage; the full suite is running.

Added `BytesMut::extend_from_within` with range validation, automatic growth, and documentation.

Tests cover range forms, empty ranges, invalid bounds, and shared or reclaimed storage.

Passed `cargo fmt --check`, tests with all features and without default features, and `git diff --check`.
