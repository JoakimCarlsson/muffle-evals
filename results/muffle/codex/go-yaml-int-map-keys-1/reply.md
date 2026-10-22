I’ll check how map keys are decoded, fix the conversion, and add a regression test.

The decoder uses Go’s integer-to-string conversion, which turns `42` into the character `*`. It already has a conversion helper that formats numbers as decimal strings; I’ll use it for map keys too. The regression tests reproduce the bug for both ordinary and named string keys.

Fixed map key conversion to format integers as decimal strings, so your example now produces `map[42:100]`.

Added regression coverage for negative, zero, large integer, and named string keys. All tests pass with `go test ./...`.
