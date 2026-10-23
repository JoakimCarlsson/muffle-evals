I’ll check the existing jitter middleware, add `WithFullJitter` alongside it, and test the range and edge cases.

Added `WithFullJitter(next Backoff) Backoff` with uniform random waits in `[0, base)`, stop propagation, and unchanged zero or negative durations.

Included documentation, a usage example, and tests covering bounds and edge cases.

Validation: `go test ./...` and `git diff --check` passed.
