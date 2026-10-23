I’ll check the existing buffer growth and range handling code, add the method and focused tests, then run the build and test suite.

This needs changes in `src/bytes_mut.rs` and the existing `tests/test_bytes.rs`; there are no callers or exports to update. I’ll follow the range handling used by `Bytes::slice` and reserve capacity before taking the copy pointers, since growth can move the buffer. No dependency or configuration changes are needed.

The method and regression test are in place. All 1,303 all-feature tests pass, including range checks against `Vec::extend_from_within` and copies from shared buffers. The build and tests without default features are still running.

Added `BytesMut::extend_from_within` with range validation, automatic growth, and a documentation example.

Tests cover empty ranges, invalid bounds, overflow, growth, and shared buffers.

Validation passed: build, formatting, 1,303 all-feature tests, and 1,176 tests without default features.
