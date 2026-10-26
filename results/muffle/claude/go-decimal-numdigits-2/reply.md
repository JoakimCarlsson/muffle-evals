Fixed in `decimal.go`: `Decimal.NumDigits` now returns the exact digit count of the coefficient.

The cause was the fast path for small coefficients (up to 2^53). It computed `int(math.Log10(x)) + 1`, and `math.Log10` is slightly inexact near powers of ten. `10^15` gave 14.999… and truncated to 14, so the result was 15 instead of 16. I replaced it with an integer loop that divides by 10 and works for any `uint64` coefficient. Larger values still use the existing bit-length estimate, which is corrected by an exact comparison against a power of ten.

I also ran a temporary test that checked every power of ten from 10^0 to 10^399, plus and minus 1, for positive and negative coefficients. The results matched `len(String())`. The existing suite passes. I deleted the temporary test, so no regression test was added for your three inputs.

I haven't committed anything.
