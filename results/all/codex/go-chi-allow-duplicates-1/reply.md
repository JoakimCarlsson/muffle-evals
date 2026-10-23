405 `Allow` duplicates need deduplication. Checking route matching and existing tests.


Done.
405 `Allow` methods deduplicated; overlapping-route regression test added. `go test ./...` and `go build ./...` passed.
