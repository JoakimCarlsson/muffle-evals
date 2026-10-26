I’ll check `NumDigits`, fix the digit count, and add regression coverage for powers of ten.

The integer fast path uses `math.Log10`, which can round incorrectly near powers of ten. I replaced it with integer division and added tests for both signs, the `int64` limits, and values around powers of ten through 10¹⁰⁰. The test suite is running.

Fixed `NumDigits` by replacing the floating-point logarithm fast path with exact integer division.

Added regression tests for your examples, negative values, `int64` limits, and power-of-ten boundaries through 10¹⁰⁰.

Validation: `go test ./...` passes.
