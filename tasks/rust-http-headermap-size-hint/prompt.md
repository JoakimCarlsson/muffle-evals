`size_hint` on the iterator from `http::HeaderMap::iter` can report a lower bound of 1 when the iterator actually has 0 elements left. The `Iterator` docs say an implementation should give a correct estimate, otherwise it violates the trait's protocol.

Version: http 1.5.0, Linux x86_64.

```rust
fn main() {
    let mut m: http::HeaderMap<http::HeaderValue> = Default::default();
    m.insert(http::header::HOST, http::HeaderValue::from_static("x"));
    let mut it = m.iter();
    let (lo, _) = std::iter::Iterator::size_hint(&it); let a = it.next(); // (1,_), Some
    let (lo, _) = std::iter::Iterator::size_hint(&it); let b = it.next(); // (1,_), None <- bug
    assert!(!(lo >= 1 && b.is_none()), "size_hint lower bound {lo} > 0 but next() == None");
    let _ = a;
}
```

Expected: `size_hint` is accurate. Actual: it is not.

Please fix this.
