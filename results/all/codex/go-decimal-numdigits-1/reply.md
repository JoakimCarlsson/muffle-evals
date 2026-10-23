Done.
`NumDigits` uses exact integer division for int64 coefficients. Regression tests cover reported numbers, negatives, boundaries. `go test ./...` and `go build ./...` pass.
