I’ll check how `NumDigits` counts digits, fix the boundary error, and add regression coverage.

The regression test confirms that `math.Log10` rounds below the boundary for `10^15`, even though the integer converts exactly to `float64`. I’ll use integer division for the `int64` path and retain the corrected big-integer path. The tests cover both signs and values around powers of ten.

Fixed `NumDigits` by replacing floating-point logarithms with exact integer division for `int64` coefficients. Your second example now returns 16.

Added regression tests for powers-of-ten boundaries, negative values, different exponents, and `int64` limits.

Validation: `go test ./...` passes.
