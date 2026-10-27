The 405 `Allow` header now lists each method once. Your example returns `Allow: POST` instead of `POST POST POST POST`, and `go test .` passes.

The change is in `methodNotAllowedHandler` in `mux.go`. It skips any method it has already added. I fixed it there rather than in `tree.go` because two separate places in `tree.go` collect the allowed methods.

I added `TestMethodNotAllowedNoDuplicateAllow` to `mux_test.go`, using your four overlapping `POST` routes. I didn't run anything beyond the root package's tests.

I haven't committed anything.
