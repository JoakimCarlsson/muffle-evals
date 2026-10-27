I’ll check how the 405 handler builds the `Allow` header, fix the duplicates, and add a regression test for overlapping routes.

The 405 handler now emits each allowed method once. The regression test covers all four overlapping routes with both POST and PUT to verify that distinct methods are preserved. The router tests pass; the middleware tests are still running.

Fixed the 405 handler so each method appears only once in the `Allow` header.

Added a regression test covering four overlapping routes with POST and PUT, verifying both methods appear exactly once.

Validation: `go test ./...` and `git diff --check` pass.
