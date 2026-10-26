I fixed `Decimal.NumDigits` so it now returns the exact digit count for your three inputs, and the full test suite passes. The `gofmt` warning on `decimal_test.go` is an existing formatting problem, not caused by my change.

**Cause:** the small-number fast path used `int(math.Log10(x)) + 1`. `math.Log10` is slightly inexact, so for `10^15` it returns a value just under 15 and the count came out one too low. It could do the same for other exact powers of ten.

**Fix:** in `decimal.go`, the fast path now counts digits with integer division, so there is no floating-point rounding. It covers any coefficient that fits in 64 bits. Larger coefficients still use the existing bit-length estimate plus exact correction, which is correct.

**Test:** I added `TestNumDigitsPowersOfTen` to `decimal_test.go`. It checks your three inputs against `len(Coefficient().Text(10))`. It also checks `10^n` and `10^n - 1` for every size up to 80 digits.

I haven't committed anything.
