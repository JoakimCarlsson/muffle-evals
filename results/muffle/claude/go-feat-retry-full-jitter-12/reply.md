I added `WithFullJitter(next Backoff) Backoff` to `backoff.go`, next to the other jitter middleware. `go test` passes and `gofmt` reports nothing.

- **Normal case:** `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it returns `0, true`, the same as the other middleware.
- **Zero or negative base:** it returns the base unchanged and doesn't panic.

I added tests in `backoff_test.go` for the range, the stop case and zero/negative bases, plus an `ExampleWithFullJitter`. I also added a short "full jitter" snippet to the Jitter section of `README.md`.

I haven't committed anything.
