Fix coefficient digit count; inspect implementation and tests.


Done.
`NumDigits` uses exact integer counting. Added regression tests for reported inputs, signed power boundaries, and int64 limits. `go test ./...` passed.
