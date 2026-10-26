I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, next to the other jitter middleware. `gofmt`, `go vet` and `go test` all pass.

- **Range:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** it is returned unchanged, so there is no panic.

I also added tests in `backoff_test.go`: one for the range (100k iterations), one for stop, one for non-positive bases, and an `ExampleWithFullJitter`. The README's Jitter section now has a short `WithFullJitter` snippet.

I didn't commit anything.
