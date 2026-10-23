Adding regression tests next to the existing findLast cases, then running the suite.

Fixed: `findLast()` and `findLastIndex()` now work inside `{ }` map literals. The full test suite passes (`go test ./...`).

**Cause:** the backward loop that `findLast` and `findLastIndex` compile to (`emitLoopBackwards` in `compiler/compiler.go`) never popped its `index >= 0` check. A leftover bool stayed on the VM stack on every iteration and on loop exit. In a map literal, the VM reads the key and value from the stack, so it picked up that stray bool as the key. That is the "interface {} is bool, not string" error. Plain calls only worked because nothing else was reading the stack.

**Fix:** I added an `OpPop` after the loop-condition jump, on both the continue path and the exit path. The forward loop doesn't have this problem.

**Tests:** I added three cases to `expr_test.go` next to the existing `findLast` tests:
- `findLast` in a map literal
- `findLastIndex` in a map literal
- `findLast` in a map literal with no match, which gives `nil`

`gofmt -l` lists four files, all existing test files I didn't touch.

I haven't committed anything.
