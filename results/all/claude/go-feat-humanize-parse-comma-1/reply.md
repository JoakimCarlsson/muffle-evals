Done. Added `ParseComma` and `ParseCommaf` to `comma.go`, with tests in `comma_test.go`. Build, vet and tests pass.

Both reject misplaced commas (`"1,23"`, `",123"`, `"1.2,345"`). `ParseCommaf` also round-trips `NaN`, `+Inf` and `-Inf`. README not updated.
