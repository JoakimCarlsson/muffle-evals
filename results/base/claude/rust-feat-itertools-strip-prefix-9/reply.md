I added `Itertools::strip_prefix` and `Itertools::strip_prefix_by`, plus the public `StripPrefixError` struct, and they behave as in your examples. The new unit test and both doctests pass. The crate also builds with `--no-default-features`. I didn't run the full test suite. `cargo test --no-default-features --lib` fails to compile on `std::panic::catch_unwind` and `vec!`, errors in code I didn't touch, so I didn't investigate them.

- **`strip_prefix(prefix)`:** it takes anything `IntoIterator` where `Self::Item: PartialEq<PrefixItem>`, and it calls `strip_prefix_by`. It returns `Ok(iter)` advanced past the prefix, and an empty prefix gives back the whole iterator.
- **`strip_prefix_by(prefix, eq)`:** `eq` is an `FnMut(&Self::Item, &PrefixItem) -> bool`, so the prefix can have a different item type.
- **`StripPrefixError<I, P>`:** it has public fields `iterator`, `prefix` and `mismatch: (Option<I::Item>, P::Item)`, as you described. I wrote `Clone` and `Debug` by hand so they only require the iterators and items to implement them, and I added `Display`. `std::error::Error` is implemented under `use_std`.

The unit test is in `tests/test_std.rs` and covers your examples. It checks that `chars().strip_prefix(...)` agrees with `str::strip_prefix` for a few cases, and it exercises `strip_prefix_by` with a differently typed prefix. The error type is in `src/strip_prefix_err.rs` and is exported through `structs`. I also added a line to `CHANGELOG.md` under 0.15.0 "Added".

I haven't committed anything.
