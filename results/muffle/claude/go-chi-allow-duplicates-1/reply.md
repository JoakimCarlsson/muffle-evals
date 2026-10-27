Add a helper that dedups.

The 405 `Allow` header now lists each method once. Your example gives `Allow: POST` instead of `POST POST POST POST`. `go test .` passes.

The router collected allowed methods from every matching route and never checked for repeats. I added a small helper, `addMethodAllowed` in `context.go`, that skips methods already collected. Both places in `tree.go` that gather methods now call it.

I also added a regression test using your four overlapping routes, in a new file, `dup_test.go`. You may want to move it into `mux_test.go`.

I haven't committed anything.
