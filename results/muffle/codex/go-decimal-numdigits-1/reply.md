I’ll check `NumDigits`, fix the digit count, and add regression coverage for the reported values.

The error comes from the floating-point logarithm in the fast path. I replaced it with integer division and added checks around powers of ten for both signs, including large coefficients and the `int64` limits. The test suite is running.

Fixed `Decimal.NumDigits` by replacing the floating-point fast path with exact integer division. Your second example now returns `16`.

Added regression tests for the reported examples, powers-of-ten boundaries, negative coefficients, and `int64` limits.

Validation: `go test ./...` passes.
