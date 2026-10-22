I’ll check the crate’s MSRV and existing conventions, then add the method, public error type, and tests for ordering and edge cases.

The requested signature requires Rust 1.51 for const generics; the crate currently declares 1.46. I’ll update that minimum and keep the implementation compatible with 1.51, including `no_std` builds.

Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum with the requested derives, key ordering, and error precedence.

Tests cover swapping, duplicate keys, vacant and out-of-bounds slots, empty arrays, and zero-sized values. All tests and doctests pass with all features and with default features disabled.

Raised the minimum Rust version from 1.46 to 1.51 for const generics.
