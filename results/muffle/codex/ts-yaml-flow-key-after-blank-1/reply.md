I’ll check how the parser handles blank lines before flow collection keys, add a regression test, and run the relevant tests.

The parser creates an extra map entry when a flow key follows a blank line or comment. That leaves the separator in an empty entry, which later triggers the `IMPOSSIBLE` error. I’ve changed it to reuse the pending entry and added tests for sequence keys, mapping keys, and your full example.

Fixed the parser to reuse the pending map entry when a flow collection key follows blank lines or comments.

Added regression tests covering sequence and mapping keys, separator preservation, and your full example.

Validation: 959 tests passed, plus type checks and lint. Two external test suites could not run because their fixture directories are missing.
