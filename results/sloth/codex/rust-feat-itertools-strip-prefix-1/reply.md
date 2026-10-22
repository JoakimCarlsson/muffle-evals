I’ll check the trait and public export conventions, then add both methods and the error type. I’ll also check the feature gates and run the existing tests.

This needs changes to `Itertools`, a new error-type module, the public exports, and the changelog. The implementation can work without allocation or new dependencies. I’ll document the iterator positions on failure, including exhaustion; existing callers and configuration need no changes.

Both methods are implemented, along with the public error type and examples. Builds pass with default features, without default features, and with allocation only. A doc example hit Rust 2018’s array `.into_iter()` behavior; I corrected it and am rerunning the tests.

Added both `Itertools` methods and public `StripPrefixError` with the requested fields and consumption behavior. Included documentation examples and a changelog entry.

Validation: all 650 tests pass; formatting, documentation, and feature-variant builds pass. Clippy reports four existing warnings in unrelated code.
