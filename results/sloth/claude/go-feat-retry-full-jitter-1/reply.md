I've added `WithFullJitter` and the tests pass; I'm wrapping up now.

- **`backoff.go`**: `WithFullJitter(next Backoff) Backoff` sits next to the other jitter middlewares. It returns a random duration in `[0, base)`.
- **Stop:** when the wrapped backoff stops, it returns `0, true`.
- **Zero or negative base:** it is returned unchanged, so there is no panic from `rand.Int64N`.
- **`backoff_test.go`**: tests for the range, stop, and non-positive cases, plus an `ExampleWithFullJitter` matching your usage.
- **`README.md`**: a short entry under the Jitter section.

`go test ./...` passes. I haven't committed anything.
