Fix is in and passes. I'm adding the cases from your report to the existing test table.

`Decimal.NumDigits` now returns the exact digit count of the coefficient. All tests pass, including the three numbers from your report.

**Cause:** the fast path for small coefficients computed `int(math.Log10(x)) + 1` in floating point. On this platform `math.Log10(1e15)` returns `14.999999999999998` instead of `15`, so 10^15 came out as 15 digits instead of 16. Exact powers of ten can hit this.

**Changes in `decimal.go`:**
- **Small coefficients:** any value that fits in 64 bits is now counted with exact integer comparison against powers of ten. There's no float arithmetic, and it also covers values above 2^53 that used to fall through to the big-integer path.
- **Large coefficients:** the bit-length estimate could only be corrected upward, so an overestimate would have gone unnoticed. It now checks and corrects in both directions.

**Tests in `decimal_test.go`:** I added your three inputs, a negative one, and values around the 64-bit boundary to `TestDecimal_NumDigits`. I also ran a temporary check, since deleted, over 10^e−1, 10^e and 10^e+1 for e up to 399, positive and negative, against `len(String())`. All matched.

I didn't commit anything.
