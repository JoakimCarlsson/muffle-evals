I added `Slab::get_disjoint_mut` with the signature you gave. The full test suite passes with default features, and the lib and integration tests also pass with `--no-default-features`.

- **Checking order:** it first looks for duplicate keys across the whole array. After that it checks keys in order, so the first bad key decides whether you get `IndexOutOfBounds` or `IndexVacant`. An empty key array returns `Ok([])`.
- **New error type:** `GetDisjointMutError` is a public enum with `OverlappingIndices`, `IndexOutOfBounds` and `IndexVacant`. It derives `Debug`, `Clone`, `PartialEq` and `Eq`. It is exported from the crate root, because it is a public item in `lib.rs`.
- **Extra trait impls:** I also gave it `Display`, plus `std::error::Error` when the `std` feature is on. You didn't ask for these.
- **Unsafe code:** the method has a small `unsafe` block inside. It only runs after every key has been checked as distinct, in bounds and occupied, so callers never see any `unsafe`.
- **Tests and docs:** I added a test in `tests/slab.rs` covering swapping, an empty array, and your three error examples (`[42, 2, 1, 2]`, `[1, 5]` and `[5, 1]`). The method also has a doc example, which is your swap snippet, and a CHANGELOG entry.

**MSRV bump:** `const N: usize` needs Rust 1.51, and the crate declared `rust-version = "1.46"`. I raised it to 1.51 in `Cargo.toml` and noted it in the CHANGELOG. If you need to keep 1.46, this signature can't be supported.

I haven't committed anything.
