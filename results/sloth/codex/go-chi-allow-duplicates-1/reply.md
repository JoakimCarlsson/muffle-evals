I’ll check where the router collects allowed methods, fix the duplicate handling, and add a regression test for overlapping routes.

Both route-matching paths collect methods, and the shared 405 handler writes them to `Allow`. I’ll deduplicate there, preserving the order of distinct methods. This needs changes only in `mux.go` and `mux_test.go`; no API or configuration changes are needed.

Fixed the shared 405 handler so each method appears only once in `Allow`, preserving the order of distinct methods.

Added regression coverage for overlapping wildcard routes and multiple allowed methods.

Validation passed: `go test ./...`, `go build ./...`, and `git diff --check`.
