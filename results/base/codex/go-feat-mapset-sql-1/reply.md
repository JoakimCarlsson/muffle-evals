I’ll check both set implementations, add SQL support, and test that failed scans preserve the existing contents.

The existing JSON decoder adds elements to a set. I’ve made `Scan` decode into a temporary set first, so it replaces the contents only after decoding succeeds. The thread-safe version holds its lock during the operation.

Implemented SQL support for both set implementations.

- `Value()` returns a JSON array as `[]byte`.
- `Scan()` replaces contents from a string or byte slice.
- `Scan(nil)` clears the set.
- Unsupported types and invalid JSON return errors without changing contents.

Added tests for integers, strings, errors, and concurrent access. Both `go test ./...` and `go test -race ./...` pass.
