I added `strip_prefix` and `strip_prefix_by` to `Itertools`, plus the public `StripPrefixError` struct. The build and the existing tests pass, and so do the new doc-tests. Clippy reports no warnings from the new code. I didn't add unit tests, and I didn't check the `"hello".chars()` agreement with `str::strip_prefix` separately.

- **`strip_prefix(prefix)`**: it takes `self` by value and returns `Result<Self, StripPrefixError<…>>`. It needs `Self::Item: PartialEq<PrefixItem>`, and an empty prefix returns the whole iterator.
- **`strip_prefix_by(prefix, eq)`**: the same, but compares with your `FnMut(&Self::Item, &PrefixItem) -> bool` closure, so the prefix can have a different item type. `strip_prefix` just calls it with `==`.
- **`StripPrefixError`**: it has the public fields `iterator`, `prefix` and `mismatch`, as you described, and is re-exported from the crate root. It lives in the new `src/strip_prefix_err.rs`.
- **Docs and changelog**: the doc-tests cover your three examples and a `strip_prefix_by` one with a different item type. I also added a line under "Added" in `CHANGELOG.md`.

I left `StripPrefixError` without `Display` or `Error` impls, since the error carries the iterators and can't be shown meaningfully. I haven't committed anything.
