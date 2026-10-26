I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, right after `WithJitterPercent`. `go vet` and `go test ./...` pass.

- **Normal case:** `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** the value is returned unchanged and nothing panics.

I also added tests in `backoff_test.go`. They cover the range over 100,000 draws, the zero, negative and stop cases, and an `ExampleWithFullJitter`. The README's Jitter section now has a short snippet showing `WithFullJitter`.

I haven't committed anything.
