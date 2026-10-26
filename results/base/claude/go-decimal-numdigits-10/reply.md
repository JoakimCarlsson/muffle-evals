I fixed `NumDigits`, and it now returns the exact digit count. Your three examples give 15, 16 and 17, and the full test suite passes.

**Cause:** the fast path for small coefficients used `int(math.Log10(float64(n))) + 1`. `Log10(1e15)` can come out slightly below 15, so it truncated to 14 and the function returned 15 for a 16-digit number.

**Fix:** in `decimal.go`, a new helper `numDigitsUint64` counts digits with integer division, so there's no floating point involved. It's used for every coefficient that fits in 64 bits, including `math.MinInt64`. Larger coefficients still use the existing big-int path, which already corrects its estimate exactly.

**Tests:** I added `TestDecimal_NumDigitsPowersOfTen` to `decimal_test.go` with your three inputs. I also ran a throwaway check against every power of ten up to 10^79, each ±1 and negated, plus `MinInt64`. All matched, and I deleted that file afterwards.

I didn't commit anything.
