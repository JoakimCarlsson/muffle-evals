test_core is no_std-ish; I'll move the String comparison to use `Vec`-free check.

I added `Itertools::strip_prefix` and `strip_prefix_by`, and the new public `StripPrefixError` struct. The full test suite passes with `--all-features`, and `test_core` also passes with `--no-default-features`. `cargo fmt --check` is clean.

- **Methods:** both are in `src/lib.rs`. `strip_prefix` requires `Self::Item: PartialEq<P::Item>` and calls `strip_prefix_by` with `==`. An empty prefix returns the whole iterator.
- **Error type:** `StripPrefixError<I, P>` is in the new `src/strip_prefix_err.rs` and exported with the other structs. Its public fields are `iterator`, `prefix` and `mismatch`, and it derives `Clone` and `Debug`.
- **Tests:** I added a `strip_prefix` test to `tests/test_core.rs`. It covers every example from your request, including the `"hello"` check against `str::strip_prefix`. It also covers an empty prefix and a prefix that exactly consumes the iterator. Doctests are on both methods.

I didn't add a CHANGELOG entry. The `0.15.0` section lists changes by PR number, so I left that for you to add.
