I’ll check the slab storage and test layout, add the API and error type, then run the build and tests.

The change needs the public error enum and method in `src/lib.rs`, plus tests in `tests/slab.rs`. Existing APIs can stay unchanged. The requested const-generic signature also requires raising the minimum Rust version from 1.46 to 1.51; I’ll keep the implementation compatible with 1.51 and `no_std`.

The API passes the requested ordering and error cases, including empty input, vacant slots, and duplicate invalid keys. All 87 tests and doctests pass, along with the `no_std` build, Clippy, and formatting checks. I’m checking compilation with Rust 1.51 as well.

Added `Slab::get_disjoint_mut` and the public `GetDisjointMutError` enum with the requested derives, variants, ordering, and error precedence.

Raised minimum Rust to 1.51 for const generics.

Verified: all 87 tests and doctests, `no_std` build, Clippy, formatting, and Rust 1.51 compilation.
