I’ll inspect `NumDigits`, fix the digit count, and add regression coverage for the reported case.

The small-integer fast path uses `math.Log10`, which can round incorrectly near powers of ten. I’ll replace it with integer division and test powers of ten and their neighbors, including negative coefficients.

Fixed `NumDigits` by replacing the floating-point fast path with exact integer division.

Added regression coverage for your examples, positive and negative power-of-ten boundaries, and `int64` limits.

Validation: `go test ./...` passes.
