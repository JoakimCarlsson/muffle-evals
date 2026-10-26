I added `WithFullJitter(next Backoff) Backoff` to `backoff.go`, next to the other jitter middleware. `gofmt` is clean and `go test ./...` passes.

- **Range:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** the value is returned unchanged, so there is no panic.

I also added tests in `backoff_test.go`. They cover the range over 100k draws, zero and negative bases, stop propagation, and an `ExampleWithFullJitter`. The README's Jitter section now has a short example too.

I didn't commit anything.
