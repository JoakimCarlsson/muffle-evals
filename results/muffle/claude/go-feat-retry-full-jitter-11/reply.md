I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, next to the other jitter middleware. `gofmt`, `go vet` and `go test` all pass.

- **Normal case:** it returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** it returns the base unchanged and doesn't panic.

I added tests in `backoff_test.go` for the range (1000 iterations), stop propagation, and zero and negative bases. I also added an `ExampleWithFullJitter` there and a short section in the README's Jitter docs with a link to the AWS article.

I haven't committed anything.
