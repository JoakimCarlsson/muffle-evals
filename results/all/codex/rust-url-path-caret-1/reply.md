Path encoding fix: inspect shared encode set and callers, add caret, run existing tests.


Done.
Shared path set encodes `^` as `%5E`; removed three obsolete expected failures. `cargo build -p url` and `cargo test -p url` pass.
