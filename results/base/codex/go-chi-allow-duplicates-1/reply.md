I’ll check how the router collects methods for 405 responses, fix the duplicates, and add a regression test for overlapping routes.

Fixed the 405 handler to include each method only once in the `Allow` header.

Added regression tests for overlapping routes with both single and multiple allowed methods. Confirmed they failed before the fix and pass afterward.

Validation: `go test ./...` passes.
