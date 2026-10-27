Done. `Slab::get_disjoint_mut` and the public `GetDisjointMutError` are added in `src/lib.rs`. Tests for each case you listed and the doctest pass.

Const generics need Rust 1.51, so I bumped `rust-version` in `Cargo.toml` from 1.46 to 1.51. The method uses one `unsafe` block inside the crate, so callers need none. I did not update `CHANGELOG.md`.
