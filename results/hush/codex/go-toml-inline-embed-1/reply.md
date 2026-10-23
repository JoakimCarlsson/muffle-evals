Embedded `inline` decoding needs fixing; checking field lookup and regression tests.


Done.
Fixed embedded `inline` decoding; preserved explicit names. Added regression tests for values, pointers, empty tags, multiple options. `go test ./...` passed.
