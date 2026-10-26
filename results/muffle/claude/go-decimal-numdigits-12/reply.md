The fast path uses `math.Log10`, which isn't exact for powers of ten. For example, `Log10(1e15)` can return 14.999…, which gives 15 instead of 16. I'll replace it with an exact integer comparison.

I fixed `NumDigits` in `decimal.go`. It now returns 16 for your second example. `go vet` is clean and the full test suite passes.

**Cause:** the fast path for small coefficients used `int(math.Log10(x)) + 1`. `math.Log10` isn't exact for powers of ten, so `Log10(1e15)` comes out slightly below 15. That truncates to 14 and gives 15 digits instead of 16.

**Fix:** coefficients that fit in 64 bits are now counted with integer division, so the result is exact. This also covers values above 2^53, which previously went to the estimate-and-correct big-int path. Larger coefficients use that path as before. I checked its logic and it can only be off by one in a direction the existing correction handles.

**Test:** I added `TestNumDigitsPowersOfTen` to `decimal_test.go`. It checks 10^n, 10^n−1 and −10^n for n up to 59 against `len(Text(10))`, so it exercises both paths.
