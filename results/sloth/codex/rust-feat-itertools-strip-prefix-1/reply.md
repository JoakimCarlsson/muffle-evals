I’ll check the trait, exports, and test conventions, then add the methods and error type with focused tests.

The change needs two `Itertools` methods, a public error type exported at both the crate root and `structs`, and tests in `tests/test_core.rs`. It needs no allocation or feature flags. Both methods can share one comparison loop, which will stop immediately on mismatch or exhaustion.

The implementation is in place. The tests cover successful and empty prefixes, mismatch recovery, early exhaustion, different item types, a mutable comparator, and agreement with `str::strip_prefix`. They also check that an iterator which resumes after returning `None` is returned without extra polling. I fixed a Rust 2018 array iteration issue in the test; validation is continuing.

Added `strip_prefix`, `strip_prefix_by`, and public `StripPrefixError` with the requested fields and recovery behavior.

Validation passed: all 651 tests, no-default-features tests and builds, and formatting. Clippy passes with four pre-existing `question_mark` warnings suppressed.
