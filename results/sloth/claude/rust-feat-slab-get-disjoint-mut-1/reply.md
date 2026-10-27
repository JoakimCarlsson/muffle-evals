Adding the method and error type now. Const generics and `[T; N]::map` need Rust 1.55, so I'm bumping `rust-version` from 1.46.

`Slab::get_disjoint_mut` is added in `src/lib.rs`, along with a public `GetDisjointMutError` enum. The enum has the variants and derives you specified, and it is exported from the crate root. The full test suite and doctests pass.

- **Behaviour:** results come back in key order, and `[]` gives `Ok([])`. Duplicate keys are checked first, then the keys in order, so `[42, 2, 1, 2]` is `OverlappingIndices`. On a 5-slot slab with key 1 vacant, `[1, 5]` is `IndexVacant` and `[5, 1]` is `IndexOutOfBounds`.
- **Tests:** I added two to `tests/slab.rs`, covering ordering plus the empty array, and each error case. The swap example from your request is the doctest on the method.
- **`unsafe` in the implementation:** the method has one small `unsafe` block, with a safety comment, because turning the checked keys into `N` simultaneous `&mut` references isn't possible in safe Rust. Callers never need `unsafe`.
- **MSRV bump:** const generics and `[T; N]::map` need Rust 1.55, so I raised `rust-version` in `Cargo.toml` from 1.46 to 1.55. That is a visible compatibility change for the crate. I did not touch `CHANGELOG.md` or any CI config.

Nothing is committed.
