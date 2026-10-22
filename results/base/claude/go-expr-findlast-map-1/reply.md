Identical to find; so the difference is in emitLoopBackwards.

Now add a test and run.

Fixed: all tests pass, including a new regression test.

**Cause:** `emitLoopBackwards` in `compiler/compiler.go` left a stray bool on the VM stack. The loop's `index >= 0` check is followed by `OpJumpIfFalse`, which doesn't pop the bool. Every iteration pushed one that was never removed, and the exit path left one too. At top level the extra values were ignored. Inside a `{ }` literal, the map builder read the leftover bool as a key and failed with `interface {} is bool, not string`.

**Fix:** I added an `OpPop` right after the jump, so the loop body starts with a clean stack. I added another `OpPop` at the loop's exit target, so the false check result is discarded when the loop runs out.

**Test:** `TestExpr_findLast_in_map_literal` in `expr_test.go` covers `findLast` and `findLastIndex` in a map literal. It includes a no-match case that returns `nil`.

I didn't commit anything.
