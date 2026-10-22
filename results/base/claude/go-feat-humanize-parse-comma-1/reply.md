I added `ParseComma` and `ParseCommaf` to `comma.go`, and `go vet` and the package tests pass.

- **Round trips:** `ParseComma(Comma(n))` returns `n` for every `int64` I tried, including `math.MinInt64` and `math.MaxInt64`. `ParseCommaf(Commaf(f))` returns `f` for the floats I tried, including `MaxFloat64`, `SmallestNonzeroFloat64` and `1e21`.
- **Accepted input:** negative numbers and plain numbers without commas (`"10"`, `"10.11"`) parse as you asked. `ParseCommaf` also accepts the `"NaN"`, `"+Inf"` and `"-Inf"` strings that `Commaf` can produce.
- **Errors:** `""`, `"abc"`, `"123a456"`, `"1.2.3"` and `"1.5"` (for `ParseComma`) return an error and `0`. So does an integer that doesn't fit in an `int64`.
- **Strict comma placement:** I made the comma grouping strict. `"1,2"`, `"1,2345"`, `",123"` and `"123,"` are rejected, because accepting them would let malformed pastes through. Say so if you'd rather be lenient.
- **Other rejected forms:** `ParseCommaf` rejects `"1e5"`, `".5"`, `"1."` and `"inf"`, because `Commaf` never produces them.

I added `TestParseComma` and `TestParseCommaf` to `comma_test.go`. I didn't commit anything.
