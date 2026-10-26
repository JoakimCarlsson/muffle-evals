I’ll check `NumDigits`, fix the digit count, and add regression tests for the boundary cases.

The fast path uses `math.Log10`, which can round incorrectly even when the integer converts exactly to `float64`. I replaced it with integer arithmetic and added tests around powers of ten, including negative coefficients and different exponents. The test suite is running.

Fixed `NumDigits` by replacing the floating-point logarithm fast path with exact integer arithmetic.

Added regression tests for your examples, powers-of-ten boundaries, negative coefficients, and int64 limits.

`go test ./...` passes.
