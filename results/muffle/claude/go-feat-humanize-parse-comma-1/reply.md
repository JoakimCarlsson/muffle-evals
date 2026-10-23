I added `ParseComma` and `ParseCommaf` to `comma.go`, with tests in `comma_test.go`. `go vet` and `go test` pass.

- **Round trips:** `ParseComma(Comma(n))` gives back `n` for every `int64`, including `math.MinInt64` and `math.MaxInt64`. `ParseCommaf(Commaf(f))` gives back `f`, including very large and very small values.
- **`ParseCommaf` extras:** it also accepts `NaN`, `+Inf` and `-Inf`, since `Commaf` can produce them.
- **Accepted input:** negative numbers and plain numbers without commas (`"10"`, `"10.11"`, `"1234567"`) work.
- **Errors:** `""`, `"abc"`, `"123a456"`, `"1.2.3"` and `"1.5"` for `ParseComma` all return `0` and an error. Values that don't fit in an `int64` or `float64` do too.
- **Strict comma placement:** commas must sit between groups of exactly three digits, so `"1,23"` and `"123,"` are errors. Strings like `"1234,567"` are rejected rather than guessed at.
- **Other rejected formats:** a leading `+`, whitespace, and exponent notation such as `"1e5"` are also errors. Say so if you'd rather be more lenient with pasted input.

I made no commit.
