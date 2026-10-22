I’ll trace how the reverse searches affect the VM stack, fix the issue, and add regression tests for map values.

The reverse loop leaves its condition boolean on the stack on every iteration and at exhaustion. Map construction then reads that boolean as a key. I’ve added cleanup on both paths and regression tests for matches, no matches, and empty arrays, with optimization enabled and disabled. The full test suite is running now.

Fixed both builtins by cleaning up the reverse loop’s condition boolean, which was left on the VM stack and mistaken for a map key.

Added regression tests covering matches, no matches, and empty arrays, with optimization enabled and disabled.

All tests pass: `go test ./...`.
