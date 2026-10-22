I added `ParseComma` and `ParseCommaf` to `comma.go`. Both strip the commas and hand the rest to `strconv`. It builds and the existing tests pass. I didn't write new tests because you didn't ask for any, so the round-trip and error cases are untested.

- **Error cases:** `""`, `"abc"`, `"123a456"`, `"1.2.3"` and `"1.5"` (for `ParseComma`) all fail in `strconv`. Both functions return `0` with the error.
- **Range:** an out-of-range value also returns `0` and an error, instead of the clamped value `strconv` would give. `math.MinInt64` and `math.MaxInt64` fit, so they round-trip.
- **Non-finite floats:** `ParseCommaf` accepts `"NaN"`, `"+Inf"` and `"-Inf"`, so `ParseCommaf(Commaf(f))` works for those too.

Two things are more lenient than you might expect:

- **Comma placement:** it isn't checked, so `"1,2,3"` parses as `123`. Checking it would take a small extra validation step. I left it out because you didn't ask for it.
- **`strconv` formats:** `ParseCommaf` also accepts anything else `strconv.ParseFloat` does, such as `"1e5"` and hex floats.
