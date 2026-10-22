I’ll check the crate’s API conventions, add both methods and the error type, then run the relevant tests.

Both methods and the public error type are in place. The tests cover the returned iterator positions, different prefix item types, comparator calls, and agreement with `str::strip_prefix`. I’m also checking that an iterator which resumes after `None` is returned without further polling.

Added `Itertools::strip_prefix`, `strip_prefix_by`, and public `StripPrefixError` with the requested fields and consumption behavior. Includes documentation, examples, and edge-case tests.

Validation passed: all-target tests, core tests without default features, new doctests, and documentation build.

Clippy reports four existing `question_mark` warnings in unrelated code.
