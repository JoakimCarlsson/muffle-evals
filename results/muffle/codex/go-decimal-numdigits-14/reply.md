I’ll check `NumDigits`, fix the digit count, and add regression coverage for these cases.

The error comes from the `int64` fast path’s floating-point logarithm, which can round incorrectly at powers of ten. I replaced it with integer division and added tests around powers of ten for positive and negative coefficients and different exponents.

Fixed `NumDigits` by replacing the floating-point logarithm in the `int64` fast path with exact integer division.

Added regression tests for your examples, powers-of-ten boundaries, negative coefficients, and `int64` limits.

Validation: `go test ./...` passes.
