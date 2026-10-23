Found cause: backwards loop leaves `>= 0` bool on stack. Fixing now.

Done. `emitLoopBackwards` in `compiler/compiler.go` left the `>= 0` bool on the stack. It now pops it in the loop body and at loop exit. I added three map-literal cases to `expr_test.go`, and the full test suite passes. Nothing is committed.
