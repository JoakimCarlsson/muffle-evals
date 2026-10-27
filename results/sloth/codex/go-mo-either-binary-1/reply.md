I’ll check `Either`’s implementation and tests, then use the same pattern for `Either3`, `Either4`, and `Either5`.

I’ll decode into a fresh value so successful decoding clears any old values on the other sides. Tests will cover every side, the byte format, gob encoding inside a struct, and invalid input.

Added all four serialization methods to `Either3`, `Either4`, and `Either5`.

Tests cover every side, exact byte format, clearing inactive sides, gob round trips inside structs, and invalid input.

Passed: `go build ./... && go test ./...`.

Left out unrequested options and dependencies. Race tests were not run.
