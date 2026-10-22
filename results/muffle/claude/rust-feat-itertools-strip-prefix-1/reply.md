I wrote a silly first `strip_prefix_by` doc example; fixing it, then testing.

Doc example uses `.iter()`-style refs; fix to by-value.

Edition 2018 crate; use `.iter()` and a `&&str` item.

`Itertools` now has `strip_prefix` and `strip_prefix_by`, plus a public `StripPrefixError` struct. The doc tests pass, and so do the existing tests, fmt, and the build with `--no-default-features`. I didn't add tests under `tests/`. Nothing is committed.

- **`strip_prefix(prefix)`:** takes `self` by value and needs `Self::Item: PartialEq<P::Item>`. It returns `Result<Self, StripPrefixError<Self, P::IntoIter>>`. It calls `strip_prefix_by` with `==`.
- **`strip_prefix_by(prefix, eq)`:** takes `FnMut(&Self::Item, &P::Item) -> bool`. It walks the prefix and pulls one item from the iterator for each. On the first mismatch, or when the iterator runs out early, it returns the error. An empty prefix gives back the whole iterator.
- **`StripPrefixError`:** has public fields `iterator`, `prefix` and `mismatch: (Option<I::Item>, P::Item)`, with the semantics you described. It derives `Clone`, `Debug`, `PartialEq`, `Eq`, `PartialOrd` and `Ord`. It also implements `Display`, and `Error` under `use_std`. It lives in `src/strip_prefix_err.rs` and is re-exported from `structs`, so it is available as `itertools::StripPrefixError`.
- **Docs:** the doc examples cover your cases, including `"hello".chars().strip_prefix("he".chars())`. The `strip_prefix_by` example compares `&str` items against integers. I also added a line to `CHANGELOG.md`.

Because the iterator is passed by value, the original is gone once you call `strip_prefix`. The `Err` carries it back, stopped right after the mismatch, as you asked.
