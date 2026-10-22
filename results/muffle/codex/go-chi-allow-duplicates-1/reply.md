I’ll check how the router builds the 405 `Allow` header, add a regression test, and fix the duplicates.

The regression test reproduced the duplicates for both one and two allowed methods. The fix uses the existing method bit flags to emit each method once. The full test suite is running now.

Fixed the 405 handler to include each allowed HTTP method only once.

Added regression coverage for overlapping routes with both single and multiple allowed methods.

Validation: `go test ./...` passes.
