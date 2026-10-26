I’ll check `NumDigits`, fix the digit count, and add regression tests for the affected boundaries.

The error comes from `math.Log10` rounding near powers of ten. I replaced that fast path with exact integer arithmetic and added tests around powers of ten for both signs, different exponents, and the `int64` limits.

Fixed `Decimal.NumDigits` by replacing the floating-point fast path with exact integer arithmetic.

Added regression tests for your examples, power-of-ten boundaries, negative coefficients, and `int64` limits.

Validation: `go test ./...` passes.
