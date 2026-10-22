I’ll check the slab’s storage, exports, and Rust version requirements, then add the method and error type and run the existing tests.

The change reaches `src/lib.rs` for the method, documentation, and crate-root error type, plus `Cargo.toml` for Rust compatibility. The signature needs const generics; using array `map` keeps the implementation small and raises the minimum Rust version from 1.46 to 1.55.

Existing callers need no changes. I’ll preserve the specified error precedence and `no_std` support, with no new dependencies or extra APIs.

Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum with the requested derives, ordering, error precedence, and empty-array behavior.

Minimum Rust version is now 1.55. No dependencies added.

Formatting, build, and existing tests passed with all features and with default features disabled. Rust 1.55 itself wasn’t available to test.
