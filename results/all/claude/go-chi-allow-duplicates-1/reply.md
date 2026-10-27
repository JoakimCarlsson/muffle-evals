Dedupe at append in tree.go.

Done. `tree.go` now skips a method already in `methodsAllowed` before appending, so each method shows once in `Allow`. I added `TestMuxMethodNotAllowedNoDuplicateAllow` to `mux_test.go`. All tests pass.
