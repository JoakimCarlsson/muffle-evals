Done. Cause: `math.Log10` inexact on 10^15, fast path in `NumDigits` gave 15. Replaced with integer digit count (`decimal.go`), added `TestDecimal_NumDigitsPowersOfTen`; all tests pass.
