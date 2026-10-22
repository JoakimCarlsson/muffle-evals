I’ll check how `BytesMut` handles growth and ranges, add the method, and test the copy and panic behavior.

The method validates the range before growing the buffer, then gets the source pointer after growth so it remains valid if the allocation moves. The new tests pass for range bounds, growth, reclaimed capacity, split buffers, and invalid ranges. Documentation tests and the `no_std` check also pass.

Added `BytesMut::extend_from_within` with documentation and tests. It supports all range bounds, grows the buffer as needed, and panics on invalid ranges before mutation.

Validation passed: all 1,302 tests, formatting, documentation tests, and the `no_std` check.
