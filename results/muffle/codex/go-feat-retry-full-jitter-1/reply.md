I’ll check the existing jitter middleware, add `WithFullJitter` with edge-case tests, and run the test suite.

Added `WithFullJitter(next Backoff) Backoff` with uniform random waits in `[0, base)`, stop propagation, and unchanged zero or negative durations.

Included documentation, a usage example, and edge-case tests. `go test ./...` passes.
