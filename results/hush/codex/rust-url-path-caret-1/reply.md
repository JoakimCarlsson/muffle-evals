Path encoding fix: inspect encode set, add caret, run relevant tests.


Done.
Paths encode `^` as `%5E`. Regression tests added; three obsolete expected failures removed. `cargo test -p url` passed.
