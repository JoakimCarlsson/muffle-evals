Dedupe at append via helper.

Done. Added `Context.addMethodAllowed` in `context.go`, which skips methods already recorded. Both append sites in `tree.go` now call it. Build and existing tests pass. I didn't run your repro or add a test.
