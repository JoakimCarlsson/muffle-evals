I'm checking whether the `--no-default-features` build failure is already there without my change.

My change caused this. I inserted the `pub use` between a `#[cfg]` attribute and the `Tee` line it applies to. I'll fix that.

I added `Itertools::strip_prefix` and `strip_prefix_by`, plus the public `StripPrefixError` struct. The full test suite and doctests pass with all features, and the crate builds with `--no-default-features`. Clippy shows 4 warnings, all in code I didn't touch.

- **API:** both methods are in `src/lib.rs` and take `self` by value. `strip_prefix` requires `Self::Item: PartialEq<P::Item>`. It calls `strip_prefix_by` with `==`.
- **Error type:** `StripPrefixError<I, P>` is in the new `src/strip_prefix_err.rs` and re-exported from the crate root. It has public `iterator`, `prefix` and `mismatch` fields, laid out as you described.
- **Bounds:** because of `mismatch`, the error type is generic over both iterators, so it needs `I: Iterator` and `P: Iterator`. It derives `Clone`, `Debug`, `PartialEq` and `Eq`. I didn't add `Display` or `Error` impls.
- **Tests and docs:** a `strip_prefix` test in `tests/test_std.rs` covers your three examples, an empty prefix, and agreement with `str::strip_prefix` on `"hello"`. Both methods have doctests. I also added a line to the 0.15.0 "Added" section of `CHANGELOG.md`.

I didn't commit anything.
