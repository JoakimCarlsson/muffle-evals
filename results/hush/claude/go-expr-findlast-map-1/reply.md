Waiting on the background test run. Checking its output now.

Done. `emitLoopBackwards` in `compiler/compiler.go` left the loop-bound bool on the stack, which corrupted the map literal. It now pops it on both the loop-continue path and the loop-exit path. `findLast` and `findLastIndex` now work inside `{ }` for match, no-match and empty-array cases. I checked that with a scratch test (since deleted) and ran the compiler, vm, builtin, optimizer and root package tests, which pass. I didn't add a permanent regression test, and I didn't run the full `./...` suite.

Old background run killed at its time limit. Not restarted; fix already verified by the later foreground run.
