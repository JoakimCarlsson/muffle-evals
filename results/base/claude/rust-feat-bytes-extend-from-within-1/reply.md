I added `BytesMut::extend_from_within(range: impl RangeBounds<usize>)` in `src/bytes_mut.rs`, and your example now works. The new tests and the doctest pass. I didn't run the rest of the suite.

- **Behavior:** it appends a copy of `range` to the end and grows the buffer as needed. It panics if the start is greater than the end, or if the end is past the current length.
- **Range forms:** all range forms work, including `..`, `..=n` and `n..`.
- **Tests:** I added three tests to `tests/test_bytes.rs`. One covers the happy path, including empty ranges and a case that forces reallocation. The other two check that an out-of-bounds range and an inverted range panic.
- **Doctest:** your snippet is the doc example.
- **Not done:** I didn't add a `CHANGELOG.md` entry or commit anything.
