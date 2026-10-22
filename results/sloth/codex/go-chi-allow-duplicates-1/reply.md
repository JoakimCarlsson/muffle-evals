I’ll trace how the router builds the `Allow` header, fix the duplicate handling, and run the existing tests.

Both route lookup paths collect matching methods, and the shared 405 responder writes them all to the header. I’ll deduplicate in that responder using the existing method bit flags. This needs only a change in `mux.go`; callers, exports, fixtures, and configuration stay unchanged. Distinct methods will keep their current order, including custom methods.

Fixed in [mux.go](mux.go:526): the shared 405 responder now emits each allowed method once, including when wildcard routes overlap.

Validation passed: `go build ./...`, `go test -race ./...`, and `git diff --check`.
