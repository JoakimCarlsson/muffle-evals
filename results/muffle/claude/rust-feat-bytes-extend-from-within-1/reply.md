I added `BytesMut::extend_from_within(range: impl RangeBounds<usize>)` in `src/bytes_mut.rs`, placed right after `extend_from_slice`. The new unit tests and the doc test pass; I didn't run the rest of the test suite.

- **Behaviour:** it appends a copy of `range` to the end and grows the buffer as needed. Your example gives `b"aaabbb_bbb"`.
- **Bounds:** it panics if the range end is past the current length, or if the start is greater than the end. That matches `Vec::extend_from_within`.
- **Growth:** the source pointer is read only after the buffer has grown. If the buffer reallocates, the copy still reads from the new allocation rather than a stale pointer.
- **Tests:** in `tests/test_bytes.rs`, I added three tests.
  - Your example, plus unbounded, inclusive and empty ranges.
  - A copy that forces reallocation.
  - Two `should_panic` cases, one for an out-of-bounds range and one for an inverted range.
- **Docs:** the method has a doc comment with your example as a doc test.

I didn't add a `CHANGELOG.md` entry, and I haven't committed anything.
