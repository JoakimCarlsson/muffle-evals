I added `BytesMut::extend_from_within` in `src/bytes_mut.rs`. The full test suite passes, including the doc example from your request.

- **Bounds:** it accepts any `RangeBounds<usize>`, resolved the same way `Bytes::slice` does it. It panics if the range ends past the current length or if its start is greater than its end.
- **Growth:** it reserves space first, which may move the buffer, and only then reads the source bytes. That order is what keeps the copy safe.

I didn't add unit tests, since you didn't ask for any. The only coverage is the doc example, and the panic cases aren't tested. I also didn't touch `CHANGELOG.md`.
