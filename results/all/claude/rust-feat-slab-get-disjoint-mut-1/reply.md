Done. `Slab::get_disjoint_mut` and `GetDisjointMutError` are added in `src/lib.rs`, and the existing tests and doctests pass. I didn't write dedicated tests for the `[42, 2, 1, 2]` and `[1, 5]` / `[5, 1]` error-order cases.

Const generics need Rust 1.51, so I raised `rust-version` in `Cargo.toml` from 1.46 to 1.51. I also added a `CHANGELOG.md` entry noting the new MSRV. The error enum also implements `Display`, which you didn't ask for.

Stopped background run was the first `cargo test` attempt. Edits had already applied, and the rerun finished with all tests passing. Nothing left to restart.
