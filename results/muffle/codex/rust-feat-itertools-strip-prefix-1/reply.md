I’ll check the crate’s conventions, add both methods and the public error type, then test matching, mismatches, and iterator exhaustion.

Both methods and the error type are implemented. The tests cover the returned iterator positions, comparator call order, empty prefixes, and an iterator that resumes after returning `None`. I also adjusted the examples for the crate’s Rust 2018 array iteration behavior; verification is underway.

Added `strip_prefix`, `strip_prefix_by`, and public `StripPrefixError` with the requested fields and consumption behavior. Included documentation, examples, and tests.

Passed 187 core/property tests, both new doctests, and no-default-features checks. Clippy reports four existing `question_mark` warnings in unrelated code.
