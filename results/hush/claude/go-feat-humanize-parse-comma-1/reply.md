Done. Added `ParseComma` and `ParseCommaf` to `comma.go`, with tests in `comma_test.go`. `go test .` passes.

Parsing is strict: bad comma grouping like `"1,23"` errors. `ParseCommaf` also accepts `NaN`, `+Inf` and `-Inf`.
