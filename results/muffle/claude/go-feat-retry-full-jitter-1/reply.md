I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, next to the other jitter middleware. `gofmt` is clean and `go test ./...` passes.

- **Normal case:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** the base is returned unchanged, so nothing panics.

I also added three tests and an example to `backoff_test.go`. The tests cover the `[0, base)` range, stopping, and zero or negative bases. The README's Jitter section now shows `WithFullJitter` too.

Nothing is committed.
