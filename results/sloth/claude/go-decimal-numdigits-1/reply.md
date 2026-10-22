I'm checking the fix. The last output was too terse to confirm anything.

I fixed `Decimal.NumDigits` in `decimal.go`, and your second example now returns 16. The existing tests pass, and I added no new test since you didn't ask for one.

**Cause:** the fast path for small coefficients used `math.Log10`. `Log10` isn't exact, so for `10^15` it returned just under 15, and the digit count came out one too low. The big-integer path below it was already exact.

**Fix:** the small-coefficient path now counts digits by formatting the absolute value with `strconv.FormatUint`. This avoids any float arithmetic. It also handles `math.MinInt64`, which the old code's `-i64` handling would have mishandled.

I checked your three inputs, which now give 15, 16 and 17 and match `len(d.Coefficient().Text(10))`. Zero gives 1, and the sign isn't counted, so `-5` gives 1. The `-5` line in my scratch check printed 2 for the `len(...Text(10))` column because that text includes the minus sign, but `NumDigits` itself returned 1.

Formatting the number allocates a small string, so the small-coefficient path is a bit slower than the old float shortcut. I didn't benchmark it.
