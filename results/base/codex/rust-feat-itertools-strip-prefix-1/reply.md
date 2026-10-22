I’ll check the crate’s conventions, add both methods and the public error type, and test matching, mismatches, and iterator state.

Both methods are implemented without allocation or cloning, including support for different item types. I’m checking that they stop at the first mismatch, preserve both iterator tails, and leave the input untouched for an empty prefix.

Added `Itertools::strip_prefix`, `strip_prefix_by`, and public `StripPrefixError` with the requested fields and iterator positions. Both methods support `no_std` without allocation or cloning.

Added documentation, examples, and tests covering mismatches, exhaustion, empty prefixes, different item types, and agreement with `str::strip_prefix`.

Core tests, property tests, and all 210 doctests pass. Strict Clippy is blocked by four existing warnings in unrelated code.
