Done. Added `get_disjoint_mut` and `GetDisjointMutError` (crate-root export, also `Display`/`Error` with `std`) in `src/lib.rs`, plus a test; all tests pass.

I bumped `rust-version` from 1.46 to 1.51 in `Cargo.toml` because const generics need it. Revert it if you want to keep the old MSRV. I didn't add a CHANGELOG entry.
