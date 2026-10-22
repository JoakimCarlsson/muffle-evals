I’ll check the existing range handling and growth code, add the method in the same style, then build and run the existing tests.

This only needs a change in `src/bytes_mut.rs`; no callers, exports, fixtures, or configuration need updating. I’ll use the existing range-checking conventions and reserve capacity before taking copy pointers, since growing the buffer can move its contents. No extra API or dependencies are needed.

Added `BytesMut::extend_from_within` with range validation, automatic growth, and a documented example. It copies directly within the buffer without a temporary allocation.

Build, existing tests with all features and without default features, and formatting checks all passed.
