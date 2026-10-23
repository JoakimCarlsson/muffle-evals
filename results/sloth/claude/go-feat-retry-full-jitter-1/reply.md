I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, next to the other jitter middleware. `go vet` and the full test suite pass.

- **Range:** each `Next()` returns a random duration in `[0, base)`.
- **Stop:** if the wrapped backoff stops, it returns `0, true`.
- **Zero or negative base:** the value comes back unchanged and nothing panics.

I added three tests in `backoff_test.go`. They check the `[0, 1s)` range over 100,000 draws, that stop is passed through, and that zero and negative bases are returned as they are. I also added a short `WithFullJitter` example to the Jitter section of `README.md`.

I didn't commit anything.
