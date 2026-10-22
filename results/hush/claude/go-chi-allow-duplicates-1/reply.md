Dedupe in the handler (also covers map-order nondeterminism not at all, but fixes duplicates).

Done. `methodNotAllowedHandler` in `mux.go` now skips repeated methods, so `Allow` lists each once. Existing tests pass. I didn't add a regression test or run your exact example.
