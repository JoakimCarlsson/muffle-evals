I’ll check the existing jitter code and tests, add `WithFullJitter` in the same style, and run the build and tests.

Added `WithFullJitter(next Backoff) Backoff` beside the existing jitter middleware.

Tests cover `[0, base)`, stop propagation, unchanged zero and negative bases, and duration boundaries. The Fibonacci usage example compiles.

Passed: `go build ./... && go test ./...`.

No extra options or dependencies added. Race tests were not run.
