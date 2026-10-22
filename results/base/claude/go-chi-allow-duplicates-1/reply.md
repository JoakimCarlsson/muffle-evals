Simplest: dedupe at both append sites via a helper.

The 405 `Allow` header now lists each method once, so your example returns `Allow: POST` instead of `POST POST POST POST`. I added a regression test using that exact example, and `go test .` passes.

The duplicates came from the route lookup in `tree.go`. It tries each overlapping wildcard route in turn, and every route that matched the path added its methods to the list. I added a small helper, `addMethodAllowed`, to `context.go`. It skips a method that is already in the list, and both places in `tree.go` that collected methods now use it.

The test is in a new file, `dup_test.go`. I haven't committed anything.
