I’ll check `NumDigits`, fix the digit-count calculation, and add regression coverage.

The small-integer fast path uses `math.Log10`, which can round incorrectly near powers of ten. I’ll replace it with integer division and test powers of ten and their immediate neighbors, including negative coefficients.

Fixed `NumDigits` by replacing the floating-point fast path with exact integer division.

Added regression coverage for your examples, powers-of-ten boundaries, negative coefficients, and `int64` limits.

Validation: `go test ./...` passes.
