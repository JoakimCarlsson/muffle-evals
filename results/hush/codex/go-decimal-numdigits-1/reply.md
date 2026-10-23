`NumDigits` should return exact coefficient digits. Checking implementation and tests.


Done.
`NumDigits` uses exact integer counting. Added regression tests for powers of ten, signs, exponents, and integer limits. `go test ./...` passed.
