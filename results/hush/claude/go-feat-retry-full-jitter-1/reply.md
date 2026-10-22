Add README and tests.

Done. `WithFullJitter` in `backoff.go` returns a random duration in `[0, base)`, passes stop through, and returns a zero or negative base unchanged. Added tests, an example and a README entry; `go test ./...` passes.
