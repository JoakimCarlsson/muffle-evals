I’ll check both set implementations and their JSON methods, add database support, and test the scan behavior you described.

The existing JSON decoder adds elements to the set. I’ll have `Scan` decode into a temporary set before replacing the contents, so failed scans leave the original set intact. The thread-safe implementation will use its existing lock.

Implemented `driver.Valuer` and `sql.Scanner` for both set implementations.

- `Value` returns a JSON array as `[]byte`.
- `Scan` replaces contents from a string or `[]byte`.
- `Scan(nil)` empties the set.
- Invalid input returns an error without changing the set.

Added tests for integer and string sets. Both `go test ./...` and `go test -race ./...` pass.
