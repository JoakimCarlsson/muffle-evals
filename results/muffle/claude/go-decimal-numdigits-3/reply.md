`NumDigits` now returns the exact digit count. Your three examples give 15, 16 and 17, matching `len(d.Coefficient().Text(10))`. The full test suite passes.

**Cause:** the fast path for small coefficients used `int(math.Log10(float64(n))) + 1`. `math.Log10` isn't exact at powers of ten, so for 10^15 it returns a value just under 15 and the count comes out one too low. That is why only the second number was wrong. The first and third coefficients happen to avoid this.

**Fix** (`decimal.go`):
- The fast path still starts from `math.Log10`, but now checks the result against a table of exact powers of ten (`pow10Uint64`) and adjusts by one if needed.
- The big-integer path was already exact, so I left it alone.

**Test:** I added `TestDecimal_NumDigitsExact` to `decimal_test.go`. It covers your three inputs and every 10^i−1, 10^i and 10^i+1 up to 10^17, positive and negative.

`gofmt -l` flags `decimal_test.go`, but it flagged the file before my change too, so I didn't reformat it. I made no commit.
