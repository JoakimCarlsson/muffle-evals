I’ll check the existing accessors and test style, then add the method, public error type, and focused tests for the specified ordering and edge cases.

The crate currently targets Rust 1.46; the requested const-generic signature requires Rust 1.51, so I’ll raise that minimum. The method will check all duplicates first, then validate slots in key order. Existing accessors can stay unchanged.

Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum with the requested derives and error precedence.

Tests cover swapping, result order, duplicate precedence, invalid slots, empty arrays, and zero-sized values. Build and tests pass with all features and without default features.

Raised the minimum Rust version to 1.51 for const generics; testing on Rust 1.51 itself was not run. No additional API was added.
