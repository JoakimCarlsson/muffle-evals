I’ll trace how block maps handle blank lines before flow collection keys, add regression coverage, and run the build and tests.

The parser creates an extra map item when a flow key follows blank lines or comments. That leaves the spacing in a comment-only item, which later triggers the `IMPOSSIBLE` error. I’ll fix the item creation condition and add tests in the existing flow-key group; no API, export, config, or fixture changes are needed.

The fix passes the reported example and tests for sequence and mapping keys after blank lines or comments. The build and type checks pass, and all 955 available tests pass. Two external test suites could not run because their fixture directories are missing from this checkout.

Fixed the parser to reuse the pending map item when a flow collection key follows blank lines or comments.

Added regression coverage for both flow key types and your YAML spec example.

Build, type checks, lint, and all 955 available tests pass. Two external suites could not run because their fixture directories are missing.
