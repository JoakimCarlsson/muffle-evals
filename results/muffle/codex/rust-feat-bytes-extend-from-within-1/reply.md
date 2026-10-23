I’ll check how `BytesMut` handles ranges and buffer growth, add the method, and test it.

The method validates the range before reserving space and gets the source pointer after reservation, since growth can move the buffer. The tests cover range bounds, empty ranges, buffer growth, shared storage, and invalid ranges.

Added `BytesMut::extend_from_within` with documentation and tests. It supports all range bounds, grows as needed, and panics on invalid ranges before modifying the buffer.

Validation passed: all 1,303 tests, no-default-features check, formatting, and diff checks.
