Dedupe in the handler, preserving order.

Done. `methodNotAllowedHandler` in `mux.go` now skips methods already added, so each appears once in `Allow`. Existing tests pass; I didn't add a regression test or run your example.
