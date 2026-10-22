I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, next to the other jitter middleware. `go vet` and `go test ./...` pass.

- **Range:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** it is returned unchanged with `stop` false, so `rand.Int64N` is never called with a non-positive argument and nothing panics.

I added tests in `backoff_test.go` for the range, stop propagation, and zero and negative bases. I also added a short usage line to the Jitter section of `README.md`.

I also added an `ExampleWithFullJitter`, but it differs from the existing examples. It has an `// Output:` line, so `go test` runs it, and the retried function returns nil straight away, so it never waits. The existing `ExampleWithJitter` has no `// Output:` line, so `go test` only compiles it.

I haven't committed anything.
