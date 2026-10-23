I added `ParseComma` and `ParseCommaf` to `comma.go`, and `go test .` passes. Each one strips the commas and then calls `strconv.ParseInt` or `strconv.ParseFloat`. On any error they return `0` and the error.

I added `TestParseComma` and `TestParseCommaf` to `comma_test.go`:
- **Round trips:** `ParseComma(Comma(n))` returns `n` for `0`, `10`, `1000`, `123456789`, `-834142`, `math.MinInt64` and `math.MaxInt64`. `ParseCommaf(Commaf(f))` returns `f` for `0`, `10`, `10.11`, `834142.32`, `-834142.32`, the largest and smallest float64 values, and `±Inf`.
- **Errors:** `""`, `"abc"`, `"123a456"`, and `"1.2.3"` (for `ParseCommaf`) return `0` and an error. For `ParseComma`, `"1.5"` and `"9,223,372,036,854,775,808"` (one past `MaxInt64`) do the same.

- **Comma placement:** The parsers don't check where the commas are, so `"1,2,3"` parses as `123`. I left this out because you didn't ask for it. Checking would take a few more lines.
- **`NaN`:** `ParseCommaf("NaN")` returns `NaN`, which is what `Commaf` produces for it. I didn't add a round-trip test for it, since `NaN != NaN`.
