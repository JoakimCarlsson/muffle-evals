I’ll trace how the reverse-search builtins compile, fix the stack handling, and add regression tests for map literals.

The reverse loop leaves its condition boolean on the stack on every iteration and when it exits. Map construction then reads that boolean as a key. I’ve added cleanup on both paths; the regression tests cover both builtins with matches, no matches, and empty arrays, with optimization enabled and disabled.

Fixed both builtins by removing leftover loop-condition booleans from the VM stack, which caused map construction to read a boolean as a key.

Added regression tests covering matches, no matches, and empty arrays, with optimization enabled and disabled. Confirmed they failed before the fix.

All tests pass with `go test ./...`.
