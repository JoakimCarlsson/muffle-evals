I added `WithFullJitter(next Backoff) Backoff` to `backoff.go`, right after `WithJitterPercent`. `gofmt` is clean and `go test ./...` passes.

- **Normal case:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it stops too, returning `0, true`.
- **Zero or negative base:** it is returned unchanged and doesn't panic, because the random call only runs when the base is positive.

I added tests in `backoff_test.go`. One checks 100,000 draws against the `[0, 1s)` range. The other covers zero, negative and stop propagation. I also added a short `WithFullJitter` example to the Jitter section of `README.md`.

I haven't committed anything.
