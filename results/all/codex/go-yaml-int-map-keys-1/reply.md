Integer map keys should retain decimal text. Checking decoder paths and existing tests.


Done.
Integer keys now decode as decimal strings. Regression tests cover zero, negatives, limits, named strings. `go test ./...` and `go build ./...` pass.
