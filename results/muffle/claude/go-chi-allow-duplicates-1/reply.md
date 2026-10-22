I'll dedupe where the methods are appended, so custom 405 handlers also get unique values.

Each method now appears only once in the `Allow` header. Your example returns `Allow: POST`, and `go test .` passes.

Routing can reach the same leaf through several wildcard branches, and each visit appended that leaf's methods again. I added `Context.addMethodAllowed` in `context.go`, which skips a method already recorded. The two append sites in `tree.go` now call it. Because the fix is in the routing context, custom `MethodNotAllowed` handlers also see a deduplicated `methodsAllowed`.

I also added a regression test, `TestMethodNotAllowedNoDuplicateAllow`, using your four routes. It's in a new file, `dup_test.go`, and you may want to move it into `mux_test.go`.

I haven't committed anything.
