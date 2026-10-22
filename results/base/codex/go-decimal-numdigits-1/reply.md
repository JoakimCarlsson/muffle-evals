I’ll check `NumDigits`, fix the digit count, and add regression tests for the failing case and nearby powers of ten.


Fixed `NumDigits` by replacing floating-point logarithms in the `int64` path with exact integer division.

Added regression tests for your examples, powers of ten and adjacent values, negative coefficients, and `int64` limits.

Validation: `go test ./...` passes.
