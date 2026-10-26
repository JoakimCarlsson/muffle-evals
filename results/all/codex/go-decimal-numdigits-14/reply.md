`NumDigits` must count coefficient digits exactly; checking implementation, callers, and tests.


Float logarithms miscount exact integers. Scope: shared method and existing tests; power, exponential, and logarithm callers inherit fix.


Done.
`NumDigits` uses exact integer counting. Added reported cases, signed boundaries, and powers-of-ten tests. `go test ./...` passed.
