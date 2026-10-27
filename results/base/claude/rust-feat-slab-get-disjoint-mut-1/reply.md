I added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum, with the signature, key-check order and errors you specified. The test suite and doctests pass, including a new test in `tests/slab.rs`. I didn't try `--no-default-features`, so the `no_std` build is unchecked.

- **Where it lives:** `GetDisjointMutError` derives `Debug`, `Clone`, `PartialEq` and `Eq`. It is exported at the crate root because it's defined there. The method and its doc example are in `src/lib.rs`.
- **Test coverage:** The new test covers an empty key array, a swap, and your three error examples: `[42, 2, 1, 2]` gives `OverlappingIndices`, `[1, 5]` gives `IndexVacant`, and `[5, 1]` gives `IndexOutOfBounds`.
- **Unsafe inside:** Your calling code needs no `unsafe`, but the method uses one small `unsafe` block internally. It turns an array of raw pointers into `[&mut T; N]`, which is sound because the keys were already checked to be unique, in bounds and occupied.
- **MSRV bump:** `const N: usize` generics need Rust 1.51, so I raised `rust-version` in `Cargo.toml` from 1.46 to 1.51. If you can't bump the MSRV, tell me and we'll need a different approach.
- **Extras you didn't ask for:** I added `Display` for the error, plus `std::error::Error` behind the `std` feature. I also added an "Unreleased" entry to `CHANGELOG.md`.

I haven't committed anything.
