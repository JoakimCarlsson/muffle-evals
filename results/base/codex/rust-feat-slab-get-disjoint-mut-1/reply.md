I’ll check the crate’s implementation and compatibility requirements, then add the API and tests for ordering and error precedence.

The requested signature needs const generics, so I’ll raise the minimum Rust version from 1.46 to 1.51. I’ll check duplicates first, then validate keys in order before creating the mutable references.

Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum with the requested derives and variants.

It preserves key order, checks duplicates first, reports other errors in key order, and supports empty arrays. Tests cover mutation, error precedence, and zero-sized values.

All-feature and no-default-feature tests, doctests, Clippy, and formatting checks pass. Minimum Rust version raised to 1.51 for const generics.
