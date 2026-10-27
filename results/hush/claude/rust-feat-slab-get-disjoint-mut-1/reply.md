Insert the enum before `#[derive(Clone)] enum Entry`, then bump MSRV (const generics need 1.51) and test.

Done. `Slab::get_disjoint_mut` and the public `GetDisjointMutError` are in `src/lib.rs`, with a test in `tests/slab.rs`. Tests pass with default features and with `--no-default-features`. The implementation uses a small `unsafe` block.

- **MSRV bump:** const generics need Rust 1.51, so I raised `rust-version` in `Cargo.toml` from 1.46 to 1.51. Revert that if you'd rather keep 1.46, but then this method can't compile.
- **Extra trait impls:** I also added `Display`, and `std::error::Error` under the `std` feature. You didn't ask for those.
- **Not done:** no `CHANGELOG.md` entry.
