I’ll trace how the reverse-search builtins use the VM stack, fix the issue, and add regression coverage for map values.

The reverse loop leaves its loop-condition boolean on the stack on every iteration and when it finishes. That extra value makes map construction read a boolean as a key. I’ve added cleanup on both paths and regression cases for matches at different positions, no match, and empty arrays, with optimization enabled and disabled.

Fixed both builtins by removing leftover loop-condition booleans from the VM stack.

Added regression coverage for map values with matches, no matches, and empty arrays, with optimization enabled and disabled.

Validation: `go test ./...` passes.
