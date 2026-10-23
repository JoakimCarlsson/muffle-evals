Fixed in `decimal.go`: `NumDigits` now returns the exact digit count of the coefficient, so `1000000000000000E20` gives 16. The tests pass.

The bug was in the fast path for coefficients below 2^53. It used `math.Log10`, which isn't exact in Go, so for 10^15 it came out just under 15 and the count was one too low. I replaced it with a plain integer loop that divides by 10 and counts. The big-integer path for larger coefficients is correct, so I left it as it was.

I added your three cases to `TestDecimal_NumDigits`, plus `999999999999999` (15 digits) and `-1000000000000000` (16 digits). I didn't run the benchmarks, so I haven't measured the speed of the loop against the old float calculation.

`gofmt -l` flags `decimal_test.go`, but it already did before my change, so I left the formatting alone.
