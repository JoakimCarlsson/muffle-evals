Fixing the failing doctest (closure's `s` is `&&str`).

I added `Itertools::strip_prefix` and `Itertools::strip_prefix_by` in `src/lib.rs`. The full test suite passes with all features, including the new doctests, and `cargo fmt` is clean. I didn't run `cargo clippy` to a clean result, so I can't say whether the new code adds warnings.

- **Success:** both return `Ok(iter)` advanced past the prefix. An empty prefix gives back the whole iterator.
- **`StripPrefixError`:** it's in `src/strip_prefix_err.rs` and exported from the crate root and `itertools::structs`. It has the public fields you listed: `iterator`, `prefix` and `mismatch`.
- **Error type parameters:** the struct is generic over the iterator, the rest-of-prefix iterator and the prefix item type, so `mismatch` can be `(Option<Self::Item>, PrefixItem)`.
- **Extra impls:** it also implements `Display`, and `Error` under `use_std`.
- **`strip_prefix` bound:** it requires `Self::Item: PartialEq<PrefixItem>`, a little looser than plain `PartialEq`, so `u8` against `&u8`-style cases work. Same-type comparisons behave as you described.
- **`strip_prefix_by`:** it takes `FnMut(&Self::Item, &PrefixItem) -> bool`.
- **Tests:** the doctests cover your three examples plus a `strip_prefix_by` example with a different prefix type. `tests/test_std.rs` has a test checking `chars().strip_prefix(..)` against `str::strip_prefix` for matching, empty, mismatching and too-long prefixes.

I didn't add a CHANGELOG entry, and I didn't commit anything.
