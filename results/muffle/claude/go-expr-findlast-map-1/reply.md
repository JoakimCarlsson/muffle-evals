Running my temporary test for the fix (compile is slow); waiting on it now.

The fix is in, but the test file wasn't created (the earlier command was interrupted). I'll add a proper regression test instead.

`findLast()` and `findLastIndex()` now work inside `{ }` map literals. The full test suite passes, including a new regression test.

**Cause:** the backwards loop in `emitLoopBackwards` (`compiler/compiler.go`) checks `index >= 0` on each iteration. The conditional jump leaves that boolean on the stack. It was never popped, so a stray `bool` stayed on the stack. A bare call hid this because the result was read off the top of the stack. Inside a map literal, the stray value was taken as a key, which gave `interface {} is bool, not string`.

**Fix:** the loop now pops the check result on both paths: when it continues into the body, and when it exits at the end.

**Test:** `TestFindLast_inMapLiteral` in `expr_test.go` covers both functions, with a match and with no match.

I haven't committed anything.

The background command from my first attempt was stopped at its time limit. It had already done its job: the Python edit ran. The temporary test file it was meant to create was never written, so there's nothing to clean up. I'm not restarting it.

The fix and the regression test came from the later runs, and the full suite passed. Nothing else is pending, and I haven't committed anything.
