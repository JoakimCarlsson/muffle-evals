I’ll check how blank lines and comments are handled before flow collection keys, fix the parser, and add regression coverage.

The parser creates an extra map item when a flow key follows a blank line or comment. That leaves the preceding item looking like a trailing map comment, which triggers `IMPOSSIBLE`. The fix reuses the pending item and preserves its whitespace and comments.

Fixed the parser to reuse the pending map item when a flow collection key follows blank lines or comments, preventing the `IMPOSSIBLE` error.

Added regression coverage for sequence and mapping keys, comment preservation, and your spec example.

Validation: 957 tests passed; type checks and lint passed. Two external test suites could not run because their fixture directories are missing.
