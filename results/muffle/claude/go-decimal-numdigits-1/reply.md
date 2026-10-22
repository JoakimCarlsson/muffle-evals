Reproduced: the float `Log10` fast path is inexact at 10^15. I'm replacing it with an exact integer check.

I fixed `NumDigits`, and it now returns the exact digit count of the coefficient. The full test suite passes.

**Cause:** the fast path for small coefficients used `math.Log10(float64(i64))`. That is slightly inexact near powers of ten. For 10^15, `Log10` returns a value just under 15, so the result was 15 instead of 16. Your second example, `1000000000000000E20`, has exactly that coefficient. The other two examples avoid it because 10^14 and 10^16 happen to come out exact or take the big-integer path.

**Fix:** in `decimal.go`, the float calculation is replaced with exact integer division, counting digits of the absolute value. The big-integer path for larger coefficients is unchanged.

I also added a regression test, `TestDecimal_NumDigitsPowersOfTen`, in `decimal_test.go`. It checks 10^n−1, 10^n and 10^n+1, positive and negative, for n up to 400, against `len(v.String())`. Before the fix it failed at 10^15 and 10^15+1.

I haven't committed anything.

That notification is for my first scratch-test command. It hung because the `cat > file` at the start had no input, and it was stopped at its time limit. It doesn't affect the fix. I reran the test properly, and the scratch file is already deleted.

I removed the stray `nd_test.go` and `git status` shows only `decimal.go` modified. The regression test I added to `decimal_test.go` was appended after that check, so it isn't in that output. The `NumDigits` fix and the full test suite are as I reported before.
