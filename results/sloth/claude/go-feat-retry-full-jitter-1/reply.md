I added `WithFullJitter(next Backoff) Backoff` to `backoff.go`, right after `WithJitterPercent`. It builds, `go vet` is clean, and the existing tests pass. I didn't write tests for it, since you didn't ask for any.

- **Normal case:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it returns `0, true`, like the other jitter middlewares.
- **Zero or negative base:** it is returned unchanged and doesn't panic. This check comes before the random call, which would panic on a non-positive bound.

I also added a short `WithFullJitter` example to the Jitter section of `README.md`. Nothing is committed.
