I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, next to the other jitter middleware. `go vet` and `go test` pass, and `gofmt` reports nothing.

- **Normal case:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** when the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** the value is returned unchanged, and it doesn't panic.

I added tests to `backoff_test.go` for the range, the stop case and zero/negative bases. I also added a short "full jitter" example to the Jitter section of `README.md`.

I haven't committed anything.
