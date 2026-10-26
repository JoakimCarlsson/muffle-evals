My gofmt run reformatted an unrelated block, so I'll revert that and keep only the new test.

`NumDigits` now returns the exact digit count of the coefficient, so `1000000000000000E20` gives 16. The full test suite passes; I didn't run your exact snippet, but the new test covers that value.

**Cause:** the small-number fast path in `decimal.go` computed the count as `int(math.Log10(float64(n))) + 1`. `math.Log10` isn't exact for every power of ten. For 10¹⁵ it returns a hair under 15, so the count came out as 15 instead of 16.

**Fix:** coefficients that fit in an `int64` are now counted with integer division. The big-integer path below it was already correct, because it checks its estimate against a power of ten.

**Test:** I added `TestDecimal_NumDigitsExact` to `decimal_test.go`. For every power of ten up to 10⁷⁹ it checks that power, the number one below it, and its negation. Each result is compared against `len(String())` of the absolute value.

I haven't committed anything.
