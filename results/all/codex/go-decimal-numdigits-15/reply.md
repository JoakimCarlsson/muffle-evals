`NumDigits` must return exact coefficient digit counts. Scope: implementation, callers, existing tests.


Done.
`NumDigits` uses exact integer counting. Regression tests cover reported values, signs, powers of ten, and integer limits. `go test ./...` passed.
