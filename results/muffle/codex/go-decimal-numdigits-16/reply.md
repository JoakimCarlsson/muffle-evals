I’ll check `NumDigits`, fix the digit count, and add regression coverage for the reported case.

The integer fast path uses `math.Log10`, which can round incorrectly at powers of ten even when the integer converts exactly to `float64`. I’ll replace it with integer division and test values around powers of ten for both signs.

Fixed `Decimal.NumDigits` by replacing the floating-point logarithm fast path with exact integer division. Your second example now returns 16.

Added regression tests around powers of ten, covering both signs, varying exponents, and `int64` limits.

Validation: `go test ./...` passes.
