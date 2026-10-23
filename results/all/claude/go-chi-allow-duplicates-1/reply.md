Dedupe at the handler, single point.

Done. `methodNotAllowedHandler` in `mux.go` now skips methods it already added, so `Allow` lists each method once. I added `TestMethodNotAllowedNoDuplicateAllow` for your example, and `go test .` passes. Nothing committed.
