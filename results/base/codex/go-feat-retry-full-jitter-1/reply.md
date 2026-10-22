I’ll check the existing jitter middleware, add `WithFullJitter` and focused tests, then run the test suite.

Added `WithFullJitter(next Backoff)` with uniform sampling in `[0, base)`, stop propagation, and unchanged zero or negative durations.

Included edge-case tests, a usage example, and README documentation.

Validation passed: `go test ./...`, `go test -race ./...`, and `git diff --check`.
