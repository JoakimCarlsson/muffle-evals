`NumDigits` now returns the exact digit count, including for `1000000000000000E20`. The full test suite passes.

The bug was in the fast path for small coefficients. It computed the count with `math.Log10`, which rounds down at some powers of ten. `Log10(1e15)` comes out just under 15, so the coefficient `1000000000000000` was counted as 15 digits instead of 16. The fix in `decimal.go` replaces the float calculation with exact integer comparison against a table of powers of ten. The big-integer path was already correct, so I left it alone.

I added `TestNumDigitsPowersOfTen` to `decimal_test.go`. It checks every power of ten up to 10^59, plus and minus one, in both signs, against `len(Coefficient().Text(10))`. I also ran a scratch version of the same check to confirm it, and deleted it afterward.

Nothing is committed.
