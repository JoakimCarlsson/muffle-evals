`Decimal.NumDigits` now returns the exact digit count, including for your `1000000000000000E20` case. The full test suite passes.

The bug was in the fast path for small coefficients. It used `math.Log10(float64(n)) + 1`, and `Log10` is slightly inexact for some exact powers of ten. For `10^15` it returns a value just under 15, so the result was truncated to 15 digits instead of 16. The big-integer path below it was already correct.

I replaced the float arithmetic with an integer loop that divides by 10 and counts. The change is in `NumDigits` in `decimal.go`.

I also added `TestNumDigitsPowersOfTen` in `decimal_test.go`. It checks your three inputs, a negative value and zero. It also checks `10^n` and `10^n - 1` for `n` up to 79, comparing each result with `len(Coefficient().Text(10))`.

`gofmt -l` flags `decimal_test.go`, but it flags it on the original code too. The complaint is about alignment in an existing test table, not my addition, so I left it alone.

I haven't committed anything.
