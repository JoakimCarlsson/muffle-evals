Now a test for the specified orderings, plus a changelog check.

I added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum. All tests pass, including a new test in `tests/slab.rs` and a doc example. I didn't commit anything.

- **Signature:** it matches what you asked for, and the references come back in the order of `keys`.
- **Error order:** it checks all keys for duplicates first, then checks the keys in order. `[42, 2, 1, 2]` gives `OverlappingIndices`. In a 5-slot slab with key 1 vacant, `[1, 5]` gives `IndexVacant` and `[5, 1]` gives `IndexOutOfBounds`. An empty array returns `Ok([])`.
- **Error type:** `GetDisjointMutError` derives `Debug`, `Clone`, `PartialEq` and `Eq`. It is defined in `src/lib.rs`, so it is exported from the crate root. I also gave it `Display` and, with the `std` feature, `std::error::Error`, which you didn't ask for.
- **Unsafe code:** the API needs none from callers, but the implementation has one `unsafe` block. It runs only after the checks above, which guarantee every key is in bounds, occupied and distinct. The block has a `SAFETY` comment.
- **MSRV:** `Cargo.toml` declares `rust-version = "1.46"`, but const generics need Rust 1.51 and the array `map` I used needs 1.55. The MSRV would need raising to at least 1.55 for this to build on the declared minimum. I only built on the local toolchain, so I haven't tested an older compiler.

I left `CHANGELOG.md` alone because its entries are tied to release versions and PR numbers.
