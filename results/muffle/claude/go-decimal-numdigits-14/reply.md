The fast path is the cause. `math.Log10(1e15)` can come out just under 15, and truncating it gives 14. I'll replace the float math with exact integer comparison.

I fixed `Decimal.NumDigits`, and the full test suite passes.

**Cause:** the fast path for coefficients that fit in an int64 computed `int(math.Log10(float64(n))) + 1`. `Log10` can return a value just below an exact integer, so for `10^15` it gave 14.99… and the result was one digit short. That is why your second number came out as 15 instead of 16.

**Fix:** in `decimal.go`, the fast path now counts digits by comparing against successive powers of ten, with no floating point. The big-integer path already had an exact correction step, so I left it alone.

**Test:** I added `TestDecimal_NumDigitsPowersOfTen` in `decimal_test.go`. It checks `10^i`, `-10^i` and `10^i - 1` for `i` from 0 to 79 against `len(coefficient.Text(10))`. I didn't re-run your exact snippet. The new test covers the same coefficients.

`gofmt -l` flags `decimal_test.go`, but it flagged it before my changes too, so I left that alone.

I haven't committed anything.
