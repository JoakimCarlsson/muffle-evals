`NumDigits` now returns the exact digit count. The fix is in `decimal.go`, and `go test ./...` passes with a new regression test.

**Cause:** the fast path for small coefficients used `math.Log10(float64(x))`. For `10^15`, which is the coefficient of `1000000000000000E20`, that call returns slightly under 15. It was truncated to 14, so the function returned 15 instead of 16. The other two cases only came out right because their coefficients happened to avoid that rounding.

**Fix:** for any coefficient that fits in `int64`, `NumDigits` now counts digits with integer division by 10. That includes `MinInt64`, which it handles without overflow. The big-integer path for larger coefficients is unchanged.

**Test:** `TestNumDigitsMatchesCoefficientText` in `decimal_test.go` compares `NumDigits` with `len(Coefficient().Text(10))`. It covers your three inputs, the `int64` boundaries, negative values, and `10^e` and `10^e − 1` for e from 0 to 59.

The integer loop is probably slower than the old float shortcut. I didn't benchmark it.

`gofmt -l` flags `decimal_test.go`. It flagged it before my change too, from existing alignment in an older test, so I left that formatting alone.
