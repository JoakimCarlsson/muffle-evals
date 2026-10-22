I’ll trace how the parser handles flow collection keys after blank lines and comments, add regression coverage, and run the relevant tests.

The parser was creating an extra map entry after the blank line or comment, leaving the separator in an empty entry. It now reuses that entry for the flow key, preserving the blank line and comment on the key. The reported example and the new regression cases pass; I’m running the full suite and type checks.

Fixed the parser to reuse the pending map entry when a flow collection key follows a blank line or comment, preventing the `IMPOSSIBLE` error.

Added regression tests for sequence and mapping keys, comment preservation, and your example.

Validation: 958 tests pass; type checks, lint, and formatting pass. Two external test suites could not run because their fixture directories are missing.
