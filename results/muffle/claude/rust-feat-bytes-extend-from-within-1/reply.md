I added `BytesMut::extend_from_within` in `src/bytes_mut.rs`. The 3 new tests in `tests/test_bytes.rs` and the new doctest pass. I didn't run the rest of the test suite, and `cargo fmt` ran over the repo.

- **Behavior:** it appends a copy of `range` to the end and reserves capacity as needed. It accepts any `RangeBounds<usize>`, including `..`, `..=n` and `n..`.
- **Panics:** it panics if the range start is greater than its end, or if the end is past the current length. That matches `Vec::extend_from_within`.
- **Implementation:** the capacity reservation can reallocate, so the source pointer is taken after it. The copy then goes from the initialized bytes into the spare capacity, so there is no temporary buffer.
- **Tests:**
  - Your example.
  - Open-ended and empty ranges.
  - A case that forces reallocation.
  - Two `should_panic` cases, one out of bounds and one with an inverted range.
- **Not done:** I didn't touch `CHANGELOG.md` or commit anything.
