I’ll check `NumDigits`, fix the digit count, and add regression coverage for the affected boundary.


Fixed `NumDigits` by replacing the floating-point logarithm fast path with exact integer arithmetic. Your second example now returns `16`.

Added regression tests for your examples, powers-of-ten boundaries, negative coefficients, and int64 limits.

Validation: `go test ./...` passes.
