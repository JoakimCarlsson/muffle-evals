I’ll trace how the router builds the `Allow` header, fix the duplicates, and add a regression test for overlapping routes.

Fixed the 405 handler to emit each method only once in the `Allow` header.

Added regression coverage for overlapping wildcard routes with both a single method and multiple methods.

Validation: `go test ./...` passes.
