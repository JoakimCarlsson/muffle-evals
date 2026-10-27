I’ll check the existing jitter middleware, add `WithFullJitter`, and test the range, stop, and nonpositive-duration behavior.

Added `WithFullJitter(next Backoff) Backoff`.

- Returns a uniformly random duration in `[0, base)`.
- Propagates stop signals.
- Returns zero and negative bases unchanged without panicking.

Added tests, a usage example, and README documentation. `go test ./...` and `git diff --check` pass.
