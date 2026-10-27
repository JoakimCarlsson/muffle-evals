I added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum, which is exported from the crate root. The full test suite passes, including a new test and your swap example as a doctest.

- **Behavior:** it follows your spec. It checks all keys for duplicates first, then checks the keys in order, so `[42, 2, 1, 2]` gives `OverlappingIndices`. On the 5-slot slab with key 1 vacant, `[1, 5]` gives `IndexVacant` and `[5, 1]` gives `IndexOutOfBounds`. An empty key array returns `Ok([])`.
- **Unsafe code:** callers need no unsafe, but the function uses one small `unsafe` block internally. It builds the `[&mut T; N]` from a raw pointer, and only after every key has been checked as in bounds, occupied and unique.
- **Extra trait impls:** beyond what you asked, I gave the error `Display` and, with the `std` feature, `std::error::Error`.
- **MSRV bump:** I raised `rust-version` in `Cargo.toml` from 1.46 to 1.63. Const generics need 1.51, and I used `core::array::from_fn`, which needs 1.63. If you'd rather keep a lower MSRV, say so and I can build the array another way.
- **Tests and changelog:** I added a `get_disjoint_mut` test in `tests/slab.rs` and an "Unreleased" entry in `CHANGELOG.md`.
- **Not done:** nothing is committed, as your instructions say.
