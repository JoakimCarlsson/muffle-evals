I’ll check the comma formatters and package conventions, add the parsers, then build and run the existing tests.

Both functions can live in `comma.go` using the existing `strings` and `strconv` imports. No callers, fixtures, config, or export lists need changes. I’ll remove commas and parse the result, returning zero on any error, including overflow. This leaves the formatters unchanged and adds no dependencies or options.

Added `ParseComma` and `ParseCommaf` in `comma.go`. Both ignore commas, support plain and negative numbers, and return zero with an error for invalid or overflowing input.

Validation passed: `go build ./...`, `go test ./...`, and `git diff --check`.
