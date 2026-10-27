I’ll check the slab implementation and compatibility requirements, then add the API, documentation, and tests for the error precedence.

The crate currently declares Rust 1.46 support. The requested const-generic signature requires Rust 1.51, so I’ll update that minimum. The implementation will check all keys before creating references and remain compatible with `no_std`.

Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum with the requested derives and variants.

The implementation preserves key order, checks duplicates first, and handles empty arrays. Tests cover error precedence, mutation, and zero-sized values.

All-feature and no-default-feature tests pass, including doctests. Raised the minimum Rust version to 1.51 for const generics and verified compilation on that version.
