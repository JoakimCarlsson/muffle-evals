I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, right after `WithJitterPercent`. `go vet` and `go test` pass, and `gofmt` reports nothing.

- **Result:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** when the wrapped backoff says stop, it returns `0, true`, the same as the other jitter middleware.
- **Zero or negative base:** the value is returned unchanged, so nothing panics.

In `backoff_test.go` I added a range test over 100,000 draws, a table test for zero, negative and stop cases, and `ExampleWithFullJitter`, which matches your usage snippet. I also added a short `WithFullJitter` entry to the Jitter section of the README.

I haven't committed anything.
