Undoing the unrelated gofmt churn I introduced in the test file, keeping only my new test.

`Decimal.NumDigits` now returns the exact digit count. For your three inputs it gives 15, 16 and 17, matching `len(d.Coefficient().Text(10))`. The test suite passes, including a new test for this. I haven't committed anything.

There were two bugs in `NumDigits` in `decimal.go`:

- **Small coefficients:** values up to 2^53 used `int(math.Log10(x)) + 1`. `math.Log10` is not exact, so `10^15` came out as 14.999… and truncated to 15 digits. I replaced this with a plain integer loop that divides by 10.
- **Large coefficients:** the estimate `BitLen / log2(10)` could be off by one in the wrong direction. The old check only corrected for an estimate that was too low in some cases, and it missed exact powers of ten. The new code takes `floor((BitLen-1) * log10(2)) + 1`, which is the digit count of the smallest number with that bit length. The true count is that value or one more, so a single comparison against `10^lowerBound` settles it.

The new `TestNumDigitsExact` in `decimal_test.go` covers your three examples. It also checks every `10^n - 1`, `10^n` and `10^n + 1` for n up to 2000 against the string length.
