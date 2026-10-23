`Slab::get_disjoint_mut` is added, and all 46 integration tests and 39 doctests pass, including the new ones.

- **API:** `GetDisjointMutError` is a public enum in `src/lib.rs` with the three variants and the derives you listed. It's exported from the crate root.
- **Error order:** duplicates are checked first. The keys are then checked in order, so `[42, 2, 1, 2]` gives `OverlappingIndices`, `[1, 5]` gives `IndexVacant` and `[5, 1]` gives `IndexOutOfBounds`. An empty array returns `Ok([])`.
- **Unsafe:** the unsafe code is one small block inside the crate. After validation it builds the references from raw pointers to distinct, in-bounds slots. Callers need no unsafe.
- **MSRV bump:** I raised `rust-version` in `Cargo.toml` from 1.46 to 1.55. Const generics need 1.51 and `[T; N]::map` needs 1.55, so the old value no longer holds. If you want to keep 1.46, say so and I'll look at an alternative, though it can't use this signature.
- **Tests:** a new `get_disjoint_mut` test in `tests/slab.rs` covers the swap, the empty array and your three error examples. The doc example covers the swap and `OverlappingIndices`.
- **Not added:** I didn't add a `Display` or `Error` impl for `GetDisjointMutError`, since you didn't ask for one. I also didn't add a CHANGELOG entry.

Nothing is committed.
