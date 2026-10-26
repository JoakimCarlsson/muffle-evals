Fixed in `decimal.go`: `NumDigits` now returns the exact digit count for `1000000000000000E20` (16).

**Cause:** the fast path for coefficients that fit in an int64 used `math.Log10`, which isn't exact for every power of ten. `Log10(1e15)` comes out slightly below 15, so the count was one short. Your first and third examples happened to avoid this.

**Fix:** the fast path now compares the coefficient against exact powers of ten instead of using floating point. It also covers the full int64 range, including the minimum value.

I left the big-integer path alone, since it already checks its estimate against an exact power of ten.

I added `TestNumDigitsPowersOfTen` in `decimal_test.go`. It checks `1` followed by 0–79 zeros, runs of nines of the same lengths, both signs, and your 16-digit case. The full test suite passes. I didn't run your original snippet or confirm that the new test fails on the old code.

I haven't committed anything.
