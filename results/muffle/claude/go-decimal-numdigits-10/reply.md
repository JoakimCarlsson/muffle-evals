The big-int path looks right. The likely culprit is the fast path, where `math.Log10` on an exact power of ten can come out slightly below the integer. I'll check that.

Confirmed: `math.Log10(1e15)` returns just under 15. I'll replace the float math in the fast path with exact integer comparison.

I fixed `NumDigits`. For `1000000000000000E20` it now returns 16, matching `len(d.Coefficient().Text(10))`. The test suite passes, and I didn't commit anything.

**Cause:** the fast path for coefficients up to 2^53 used `int(math.Log10(float64(n))) + 1`. `math.Log10(1e15)` comes out slightly below 15, so the result was 15 instead of 16. The big-int path was correct. It already checks its estimate against a power of ten.

**Fix:** in `decimal.go`, the fast path now counts digits with integer division, which is exact. The result is the same for every other input.

**Tests:** I added your three examples to `TestDecimal_NumDigits`, plus a negative one (`-1000000000000000E20`). I didn't run the new cases against the old code, but a separate check showed `1000000000000000` (1e15) was the only power of ten from 1e1 to 1e15 where the float calculation was wrong.

`gofmt -l` flags `decimal_test.go`, but it flagged it before my change too, so I left that alone.
