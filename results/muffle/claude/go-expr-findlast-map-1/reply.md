Compiler looks symmetric; look at emitLoopBackwards and the map node.

My test expectation was wrong (index of 5 is 4); fix it.

`findLast()` and `findLastIndex()` now work inside `{ }` map literals. Your two failing examples return `map[r:5]` and `map[r:4]`, and the full test suite passes.

**Cause:** the backward loop used by those two builtins (`emitLoopBackwards` in `compiler/compiler.go`) checks `index >= 0` with a jump that doesn't remove the comparison result from the stack. That boolean stayed on the stack on every iteration and again when the loop ended. In a plain call nothing noticed. Inside a map literal, the map builder took the leftover `bool` as a key, hence "interface {} is bool, not string".

**Fix:** the loop now pops that boolean on both paths, when it continues into the body and when it exits.

I added `TestExpr_findLast_inMapLiteral` to `expr_test.go`. It covers `findLast`, `findLastIndex` and a no-match case, which returns `nil`.

`gofmt -l` flags four test files, but I didn't touch any of them, and the files I changed are clean.

I haven't committed anything.
