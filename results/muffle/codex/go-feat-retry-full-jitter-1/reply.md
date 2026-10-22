I’ll check the existing jitter middleware, add `WithFullJitter`, and test its range, stop, and nonpositive-base behavior.

Added `WithFullJitter(next Backoff) Backoff` alongside the existing jitter middleware.

- Returns a random duration in `[0, base)`.
- Propagates stop.
- Preserves zero and negative durations without panicking.

Added tests, a usage example, and README documentation. `go test ./...` and `git diff --check` pass.
