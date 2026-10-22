I added `ParseComma` and `ParseCommaf` to `comma.go`, with tests in `comma_test.go`. The tests pass.

- **Round trips:** `ParseComma(Comma(n))` gives back `n`, including `math.MinInt64` and `math.MaxInt64`. `ParseCommaf(Commaf(f))` gives back `f`, including `1e21`, `math.MaxFloat64` and `±Inf`. `NaN` parses back to NaN.
- **Accepted input:** negative numbers and plain numbers without commas (`"10"`, `"10.11"`) work. A leading `+` is also accepted.
- **Errors:** `""`, `"abc"`, `"123a456"`, `"1.2.3"` and `"1.5"` (for `ParseComma`) return `0` and an error. So does a value that overflows `int64`.

Both functions reject commas that `Comma` would never produce: `"1,23"`, `"1234,567"`, `",123"` and `"123,"` all return an error. They also reject `"1e5"`, `"1."` and `".5"`. A string like `"1234,567"` is more likely a typo than a number someone meant. If you'd rather accept any comma placement, I can loosen it.

Errors are `*strconv.NumError` values with `ParseComma` or `ParseCommaf` as the function name, so `errors.Is(err, strconv.ErrSyntax)` and `errors.Is(err, strconv.ErrRange)` work.

I haven't committed anything.
