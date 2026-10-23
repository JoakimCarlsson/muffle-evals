Dedupe in the handler.

Done. `methodNotAllowedHandler` in `mux.go` now skips methods it already added to `Allow`. Existing tests pass. I didn't add a test for your repro or run the repro itself.
