Found it: the backward loop's exit `JumpIfFalse` leaves a stray bool on the stack. I'm adding a pop there.

Done. `emitLoopBackwards` in `compiler/compiler.go` left a bool on the stack, which broke the surrounding map literal. It now pops it on both the loop-continue and loop-exit paths.

Both builtins now work inside `{ }`, including when nothing matches and on an empty array. The full test suite passes. I added no permanent test.
