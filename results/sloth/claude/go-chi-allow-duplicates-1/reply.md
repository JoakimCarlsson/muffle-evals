Add a test after TestMethodNotAllowed.

The 405 `Allow` header now lists each method once. Your example returns `Allow: [POST]`, and `go test .` passes.

The router collects allowed methods from every overlapping wildcard route it visits, so the same method gets added several times. I removed the duplicates where the header is written, in `methodNotAllowedHandler` in `mux.go`. I left the collection in `tree.go` alone.

I added `TestMethodNotAllowedNoDuplicateAllow` in `mux_test.go`, which uses the four routes from your report. I ran only the root package tests, not the `middleware` package or the rest of the repo.

I didn't commit anything.
