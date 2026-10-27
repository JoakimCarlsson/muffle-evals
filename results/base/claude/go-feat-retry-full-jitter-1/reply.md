I added `WithFullJitter(next Backoff) Backoff` to `backoff.go`, right after `WithJitterPercent`. `go vet` and `go test ./...` both pass.

- **Range:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** when the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** the value comes back unchanged, so `rand.Int64N` is never called with a non-positive argument and nothing panics.

I also added three tests in `backoff_test.go` (the range, stop, and non-positive base cases) plus an `ExampleWithFullJitter`. The README's Jitter section now has a short `WithFullJitter` snippet.

Nothing is committed.
