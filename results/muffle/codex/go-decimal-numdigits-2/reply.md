I’ll check how `NumDigits` calculates the coefficient’s length, fix the rounding issue, and add a regression test.

The integer fast path uses `math.Log10`, which can round down at a power of ten even when the input converts exactly to `float64`. I replaced it with integer division and added tests around powers of ten, including negative coefficients, different exponents, and the `int64` limits. The full test suite is running.

Fixed `NumDigits` by replacing the floating-point logarithm fast path with exact integer arithmetic. Your example now returns 16.

Added regression tests around powers of ten, negative coefficients, varying exponents, and `int64` limits.

Validation: `go test ./...` passes.
