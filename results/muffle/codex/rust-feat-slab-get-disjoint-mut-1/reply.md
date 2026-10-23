I’ll check the crate’s implementation and compatibility requirements, then add the method, error type, and focused tests.

The requested signature needs const generics, so I’ll raise the declared minimum Rust version from 1.46 to 1.51. The method will check all keys for duplicates first, then check bounds and occupancy in input order before creating references.

Added `Slab::get_disjoint_mut` and public `GetDisjointMutError` with the requested derives, ordering, error precedence, and empty-array behavior.

Added documentation and tests covering swaps, errors, empty inputs, and zero-sized values. Tests pass with all features and with default features disabled.

Raised the minimum Rust version from 1.46 to 1.51 for const generics.
