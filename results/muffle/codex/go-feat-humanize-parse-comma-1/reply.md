I’ll check the comma formatters and test conventions, add the parsers, and verify round trips and invalid inputs.

Added `ParseComma` and `ParseCommaf`. Both ignore commas and return `0` with an error for invalid or out-of-range input.

Tests cover round trips, integer limits, float extremes, negative numbers, plain numbers, and invalid inputs.

`go test ./...` passes.
