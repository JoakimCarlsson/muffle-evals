I’ll check the existing comma formatters, add the parsers, and test round trips, numeric limits, and invalid input.

Added `ParseComma` and `ParseCommaf`. Both ignore commas and return `0` with an error for invalid or out-of-range input.

Tests cover numeric limits, negative values, plain numbers, float round trips, and invalid input. `go test ./...` passes.
