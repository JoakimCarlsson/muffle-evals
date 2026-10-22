`Vec<u8>` has `extend_from_within`, which copies a range of its own contents onto the end. `BytesMut` doesn't, and I can't do `buf.extend_from_slice(&buf[a..b])` because of the borrow, so I end up copying into a temporary first.

I'd like:

```rust
impl BytesMut {
    pub fn extend_from_within(&mut self, range: impl RangeBounds<usize>);
}
```

It appends a copy of the bytes in `range` to the end, growing the buffer as needed, and panics if the range is out of bounds for the current length, the same way `Vec::extend_from_within` does.

```rust
let mut buf = BytesMut::new();
buf.extend_from_slice(b"aaabbb_");
buf.extend_from_within(3..6);
assert_eq!(&buf[..], b"aaabbb_bbb");
```

Please add this.
