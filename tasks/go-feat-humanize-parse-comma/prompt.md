Add a way to parse the output of `Comma` and `Commaf` back into numbers.

I display numbers with `humanize.Comma` and `humanize.Commaf`, and users sometimes paste those strings back into a form, like `"123,456,789"` or `"-834,142.32"`. There is no function to turn them back into numbers, so I end up hand-rolling it everywhere.

I would like two functions in the `humanize` package:

```go
func ParseComma(s string) (int64, error)
func ParseCommaf(s string) (float64, error)
```

- `ParseComma(Comma(n))` should give back `n` for any `int64`, including `math.MinInt64` and `math.MaxInt64`.
- `ParseCommaf(Commaf(f))` should give back `f`.
- Negative numbers and plain numbers without commas (`"10"`, `"10.11"`) work too.
- Input that is not a number (`""`, `"abc"`, `"123a456"`, `"1.2.3"`, or `"1.5"` for `ParseComma`) returns an error and `0`.

Please add this.
