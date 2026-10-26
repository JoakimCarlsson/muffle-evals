I’ll check `NumDigits`, fix the digit count, and add regression tests for the affected boundaries.

The integer fast path uses `math.Log10`, which gives the wrong digit count at this boundary. I replaced it with integer division and added tests around powers of ten, for both signs and different decimal exponents.

Fixed `NumDigits` by replacing the floating-point logarithm fast path with exact integer division.

Added regression tests for your examples, signed integer limits, and values around powers of ten through `10^100`.

Validation: `go test ./...` passes.
