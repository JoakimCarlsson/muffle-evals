I’ll check the existing jitter code and tests, add the middleware in the same style, then run the tests and build.

The change needs a public function in `backoff.go`, coverage in `backoff_test.go`, and a README example. No existing callers, fixtures, config, or dependencies need changes. I’ll use the existing random-number API and follow the other middleware’s `(0, true)` stop convention.

Added `WithFullJitter(next Backoff) Backoff` with `[0, base)` sampling, stop propagation, and unchanged zero or negative durations.

Added README usage and tests covering bounds, duration extremes, and stop behavior.

Validation passed: `go test ./...`, `go build ./...`, and `git diff --check`.
