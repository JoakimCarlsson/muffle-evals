Done. Added `BytesMut::extend_from_within` in `src/bytes_mut.rs`, with 3 tests in `tests/test_bytes.rs` and a doc test. They pass. I ran only the new tests, not the full suite. Nothing is committed.

It panics if the range end is past `len` or the start is after the end. `cargo fmt` also ran on the repo.
