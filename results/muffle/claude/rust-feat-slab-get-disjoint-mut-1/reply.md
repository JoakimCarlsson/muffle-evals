Now a test for the specified error cases.

I added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum to `src/lib.rs`, and `cargo test` passes with a new test in `tests/slab.rs`. The enum is defined in the crate root, so `slab::GetDisjointMutError` works. It derives `Debug`, `Clone`, `PartialEq` and `Eq`.

- **Behaviour:** the method follows the signature and ordering rules you gave. Duplicate keys are rejected first. The remaining keys are then checked in order, and the first bad one decides `IndexOutOfBounds` or `IndexVacant`. An empty array returns `Ok([])`.
- **Unsafe:** callers need no unsafe code, but the method itself uses one small `unsafe` block. It runs only after every key has been checked as distinct, in bounds and occupied.
- **Test:** it covers your swap example and `[]`. It also checks `[42, 2, 1, 2]`, `[1, 5]` and `[5, 1]` on a 5-slot slab with key 1 vacant.
- **Beyond the spec:** I added a `Display` impl for the error, and a `std::error::Error` impl behind the `std` feature.
- **MSRV:** `Cargo.toml` declares `rust-version = "1.46"`, but const generics need Rust 1.51 and `[T; N]::map` needs 1.55. The MSRV needs raising to 1.55, or the method needs a different implementation. I left `Cargo.toml` alone.
- **Changelog:** I didn't add an entry to `CHANGELOG.md`.

I made no commit.
