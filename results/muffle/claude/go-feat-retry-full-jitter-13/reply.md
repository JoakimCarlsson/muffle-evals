I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, next to the other jitter middleware. `gofmt` and `go vet` are clean, and the tests pass.

- **Range:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** the value is returned unchanged, without calling the random function, so it can't panic.

I also added tests in `backoff_test.go` for the range, the stop case and the zero/negative base, plus an `ExampleWithFullJitter`. The README's Jitter section now has a short `WithFullJitter` snippet.

I haven't committed anything.
