Simplest: dedupe at the append sites via a helper on the context.

Fixed: the 405 `Allow` header now lists each method once. Your example gives `Allow: [POST]`, and `go test ./...` passes.

The cause was in route matching (`tree.go`). It appends the allowed methods each time it reaches a leaf node that matches the path. With several overlapping wildcard routes, it reaches several such leaves, so the same method was added more than once. I added `Context.addAllowedMethod` in `context.go`, which skips methods already recorded. Both append sites in `tree.go` now call it.

I also added a regression test using your example, in a new file, `dup_test.go`. You may want to move it into an existing test file.

I haven't committed anything.
