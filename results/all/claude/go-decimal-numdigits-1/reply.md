Done. In `NumDigits`, the `math.Log10` fast path was inexact near powers of ten. I replaced it with an exact integer-division loop in `decimal.go`. I added your three cases and some int64 edge cases to `TestDecimal_NumDigits`, and the build and tests pass.

The big-int path is unchanged. It checks its own estimate, and I didn't test it beyond your examples.
