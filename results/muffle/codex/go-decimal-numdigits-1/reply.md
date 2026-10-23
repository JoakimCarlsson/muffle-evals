I’ll check `NumDigits`, fix the incorrect count, and add regression coverage.

The floating-point logarithm in the fast path rounds some exact powers of ten incorrectly. I’ll replace it with integer division and test values on both sides of powers of ten, including negative coefficients.

Fixed `NumDigits` by replacing the floating-point logarithm fast path with exact integer division.

Added regression coverage for your examples, values around powers of ten, negative coefficients, and int64 boundaries.

Validation: `go test ./...` passes.
