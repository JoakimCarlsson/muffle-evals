I’ll check `NumDigits`, fix the digit count, and add regression tests for the affected values.

The integer fast path uses `math.Log10`, which rounds incorrectly for some coefficients even when their float conversion is exact. I replaced it with integer division. The regression tests reproduced the failure and cover both signs, neighboring values around powers of ten, and different decimal exponents.

Fixed `Decimal.NumDigits` by replacing the floating-point logarithm in the integer fast path with exact integer division.

Added regression coverage for powers of ten and neighboring values, both signs, decimal exponents, and int64 limits.

Validation: `go test ./...` passes.
