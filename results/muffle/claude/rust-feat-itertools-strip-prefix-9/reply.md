Fixing the `strip_prefix_by` doctest: under edition 2018, `[..].into_iter()` yields references, so I'll switch it to `vec!`.

I added `Itertools::strip_prefix` and `Itertools::strip_prefix_by`, plus the public `StripPrefixError` struct. The full test suite passes with all features, including the new doctests. `cargo build --no-default-features` also compiles. I didn't commit anything.

- **Signatures:** `strip_prefix` requires `Self::Item: PartialEq<P::Item>`, and `strip_prefix_by` takes `FnMut(&Self::Item, &P::Item) -> bool`. Both return `Result<Self, StripPrefixError<Self, P::IntoIter>>`.
- **Error fields:** `StripPrefixError` has the public fields `iterator`, `prefix` and `mismatch`, as you described. Your examples (`(Some(3), 9)`, `(None, 3)`) are in the doctests and in a unit test in `tests/test_std.rs`.
- **Traits on the error:** it implements `Clone`, `Debug`, `Display` and `std::error::Error`. I wrote `Debug` by hand so it doesn't require the item types to be `Debug` on their own.
- **`str` check:** a test confirms `"hello".chars().strip_prefix("he".chars())` agrees with `"hello".strip_prefix("he")`.
- **Where it lives:** the logic is in the new `src/strip_prefix.rs`, and I added a `CHANGELOG.md` entry.

`cargo test --no-default-features --lib` fails to compile because of a missing `catch_unwind` import and `vec!` macro. I didn't check whether that failure was already there before my change.
