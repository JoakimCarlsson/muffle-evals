I’ll check `NumDigits` and its tests, fix the digit count, and add regression coverage for the failing boundary.

The failure comes from floating-point rounding in the `int64` path. I replaced it with integer division and added checks around powers of ten for both signs and several exponents. The new tests reproduced the bug before the fix; the full suite is running now.

Fixed `NumDigits` by replacing the floating-point `int64` calculation with exact integer division. Your failing example now returns 16.

Added regression coverage for powers of ten, negative coefficients, exponents, and `int64` limits.

Validation: `go test ./...` passes.
