I’ll check `NumDigits`, fix the digit count, and add regression tests for the affected boundaries.

The fast path uses `math.Log10`, which can round incorrectly even when the integer converts exactly to `float64`. I replaced it with integer division and added tests around powers of ten, for both signs and different decimal exponents.

Fixed `NumDigits` by replacing the floating-point logarithm fast path with exact integer division.

Added regression tests for your examples, power-of-ten boundaries, negative coefficients, and int64 limits.

Validation: `go test ./...` passes.
