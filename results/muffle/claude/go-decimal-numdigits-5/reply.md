The bug is in the fast path. `math.Log10(1e15)` can return something just under 15, which truncates to the wrong count. I'll replace the float math with an exact integer comparison.

`Decimal.NumDigits` now returns the exact digit count. All tests pass and `go vet` is clean.

**Cause:** the fast path for coefficients that fit in an `int64` computed `int(math.Log10(float64(n))) + 1`. `math.Log10` isn't exact near powers of ten, so `Log10(1e15)` comes out just under 15 and truncates to 14. That made 10^15 report 15 digits instead of 16. The big-integer path below it was correct.

**Fix:** in `decimal.go`, the fast path now counts digits with integer division, so there's no floating point involved. It goes through a small `absUint64` helper, which also handles `math.MinInt64` correctly.

**Tests:** in `decimal_test.go` I added your three cases (15, 16 and 17 digits) and some boundary values to `TestDecimal_NumDigits`. I also added `TestDecimal_NumDigitsPowersOfTen`, which checks 10^k−1, 10^k and 10^k+1 for k up to 199 against `len(v.String())`.

`gofmt -l` flags `decimal_test.go`, but it flagged it before my change too, because of alignment in an existing map literal. I left that alone.

I didn't commit anything.
