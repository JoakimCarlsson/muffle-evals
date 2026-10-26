`NumDigits` must return exact coefficient digits; scope includes shared logic, callers, and boundary tests.


Done.
`NumDigits` uses exact integer counting. Added regression and boundary tests; `go test ./...` passed.
