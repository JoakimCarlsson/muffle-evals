I’ll check the existing jitter middleware, add `WithFullJitter`, and test its range and stop behavior.

Added `WithFullJitter(next Backoff) Backoff` with uniform sampling in `[0, base)`, stop propagation, and unchanged zero or negative durations.

Included documentation, a usage example, and boundary tests. `go test ./...` passes.
