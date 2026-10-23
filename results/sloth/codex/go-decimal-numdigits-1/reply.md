I’ll check `NumDigits`, its callers, and the existing tests, then fix the coefficient count and verify the boundary cases.

The error comes from the `int64` fast path: `math.Log10` rounds incorrectly near powers of ten, even when the integer converts exactly to `float64`. I’ll replace it with integer division and extend the existing `NumDigits` test with the reported examples, both signs, and boundary values.

The scope is `NumDigits` and its test. Its callers in power, exponential, and logarithm calculations will inherit the correction; no signatures, fixtures, configuration, or exports need changes.

Fixed `Decimal.NumDigits` by replacing the floating-point fast path with exact integer division. Your examples now return **15, 16, and 17**.

Added regression coverage for the examples, negative values, power-of-ten boundaries, and `int64` limits.

Validation passed: `go test ./...`, `go build ./...`, and `git diff --check`.
