I've added `BytesMut::extend_from_within`, and the new tests and doc test pass. I'm now running the rest of the test suite to check nothing else broke.

I added `BytesMut::extend_from_within(range: impl RangeBounds<usize>)` in `src/bytes_mut.rs`, and the full `cargo test` run passes, including the new tests and a doc test that uses your example.

It appends a copy of the bytes in `range` to the end and grows the buffer as needed. It panics if the range is decreasing or runs past the current length, as `Vec::extend_from_within` does. It accepts every range form, so `..`, `3..`, `..=1` and `3..6` all work.

I put three tests next to the other `extend_*` tests in `tests/test_bytes.rs`. They cover:
- your example;
- `..=1`, `12..` (the end of the buffer), an empty range, and `..` on a buffer long enough to force a reallocation;
- a panic for an out-of-bounds range;
- a panic for a decreasing range.

I haven't committed anything.
