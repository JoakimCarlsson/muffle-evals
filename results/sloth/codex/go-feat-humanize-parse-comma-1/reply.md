I’ll check the existing formatters and tests, add the parsers in the same style, and run the build and test suite.

The change needs two exported functions in `comma.go` and tests in `comma_test.go`; no existing callers, fixtures, or configuration need changes. I’ll remove commas and use Go’s standard numeric parsers, returning zero on errors, including overflow. Comma placement validation and locale options are outside this request.

Added `ParseComma` and `ParseCommaf`. Both ignore commas and return zero with an error for invalid or overflowing input.

Tests cover round trips, integer limits, float extremes, negative and plain numbers, and invalid inputs.

`go build ./...` and `go test ./...` pass.
