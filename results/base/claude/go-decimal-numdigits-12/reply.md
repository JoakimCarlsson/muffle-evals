`NumDigits` now returns the exact digit count. Your second example, `1000000000000000E20`, returns 16. The full test suite passes.

The bug was in the fast path for coefficients that fit in an int64, in `decimal.go`. It used `math.Log10`, which is not exact at powers of ten. For a coefficient of 10^15 it returned just under 15, so the result came out one digit short.

I replaced that path with an exact integer loop that divides by 10 and counts. The big-integer path for larger coefficients already checked its estimate against the real value, so I left it alone.

I added `TestDecimal_NumDigitsPowersOfTen` in `decimal_test.go`. It checks 10^n, 10^n−1 and −10^n for n up to 399 against `len(Text(10))`, plus your 16-digit case.

`gofmt -l` flags `decimal_test.go`, but it flagged the file before my change too, so I left the formatting alone.

I haven't committed anything.
