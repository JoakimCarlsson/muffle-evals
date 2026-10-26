My test expectations were wrong: NumDigits counts the coefficient, so the right values are 16 and 17. I'll fix the tests and check the gofmt complaint.

Done. The int64 fast path in `NumDigits` used `math.Log10`, which is inexact near powers of ten. I replaced it with integer math (`bits.Len64` plus a power-of-ten table), and it now handles the full int64 range. I added tests for your cases and for the int64 boundaries, and `go test ./...` passes.

`gofmt -l` lists `decimal_test.go`, but it did so before my change too.
