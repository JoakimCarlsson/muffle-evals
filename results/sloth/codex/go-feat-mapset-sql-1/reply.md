I’ll check both implementations and the existing JSON code, then add SQL support and focused tests.

The change needs to reach both concrete set types and the existing tests; no fixtures, config, or constructor changes are needed. I’ll reuse JSON marshaling and decode scans into a temporary set so errors preserve the contents. The public `Set` interface and existing `UnmarshalJSON` behavior will stay unchanged, preserving compatibility for callers.

Implemented both interfaces on both set implementations.

- `Value()` returns a JSON array as `[]byte`.
- `Scan()` replaces contents from a string or byte slice; `nil` clears the set.
- Unsupported types and invalid JSON return errors without changing contents.

Added tests for integer and string sets. `go build ./...` and `go test ./...` pass.
