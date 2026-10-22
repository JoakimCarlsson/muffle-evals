Fix is half done: the loop-condition bool also stays on the stack on the continue path. I'm adding a pop there too.

Done. `emitLoopBackwards` in `compiler/compiler.go` left its loop-condition bool on the stack. It now pops that bool when the loop continues and when it exits. Map-literal cases for `findLast` and `findLastIndex` now return correct results, and `go test ./...` passes. I didn't add a regression test.
