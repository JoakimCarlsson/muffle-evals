I’ll check the existing jitter middleware, add `WithFullJitter` in the same style, and test its range and edge cases.

Added `WithFullJitter(next Backoff) Backoff`.

- Returns a uniform random duration in `[0, base)`.
- Propagates stop signals.
- Preserves zero and negative durations without panicking.

Added tests and a README example. `go test -race ./...` passes.
