Dedupe in the handler (covers both append sites).

Fixed in `mux.go`: `methodNotAllowedHandler` now skips any method it has already added, so each one appears once in the `Allow` header of a 405 response. Both places in `tree.go` that collect allowed methods feed this handler, so the one change covers them.

The existing tests pass and `gofmt` is clean. I didn't run your example or add a regression test for the duplicate case.
