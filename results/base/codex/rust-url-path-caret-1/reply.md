I’ll check the path encoding set and regression tests, add the caret, and run the relevant tests.

The fix passes the new regression test and makes three existing WHATWG cases pass. I’ll remove those three entries from the expected-failure list and rerun the suite.

Fixed: URL paths now encode `^` as `%5E`.

Added regression coverage for parsing, relative URLs, and path setters. Removed three expected-failure entries that now pass.

Validation: `cargo test -p url`, formatting, and diff checks all pass.
