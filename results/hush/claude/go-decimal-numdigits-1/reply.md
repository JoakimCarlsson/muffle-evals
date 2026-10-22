Done. `NumDigits` fast path used float `math.Log10`, which gave 14.999… for 10^15. It now counts digits with integer division in `decimal.go`. I added `TestNumDigitsPowersOfTen`, and `go test` passes.

`gofmt -w` also reformatted some existing lines in `decimal_test.go`, which was already unformatted before my change.
