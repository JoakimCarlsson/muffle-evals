I ran `gofmt -w` on `decimal_test.go`, which was already unformatted before my change. That added unrelated formatting changes to the diff, so I'm undoing them and re-adding only my test.

`Decimal.NumDigits` now returns the exact digit count. Your second example, `1000000000000000E20`, gives 16 instead of 15, and the full test suite passes. I didn't run your exact snippet. The new test covers the same three numbers.

**Cause:** the fast path for small coefficients used `math.Log10`, which can come out slightly below the true value at exact powers of ten. For `10^15` it returns something like 14.999…, which truncates to 15 digits instead of 16.

**Fix:** in `decimal.go`, coefficients that fit in `uint64`, or in `int64` when negative, are now counted with integer division. Larger values still use the bit-length path, which already ends with an exact comparison.

**Test:** I added `TestDecimal_NumDigitsExact` to `decimal_test.go`. It uses your three numbers and some negative and edge cases. It also checks `10^e−1`, `10^e` and `10^e+1` for e from 0 to 39, comparing each result against `len(Coefficient().Text(10))`.

I haven't committed anything.
