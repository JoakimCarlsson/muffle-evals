I’ll check how `Comma` and `Commaf` format numbers, then add parsers and tests for round trips, limits, and invalid input.

Added `humanize.ParseComma` and `humanize.ParseCommaf`. Both ignore commas and return `0` with an error for invalid or out-of-range input.

Tests cover round trips, integer limits, float extremes, negative numbers, and invalid inputs. `go test ./...` passes.
