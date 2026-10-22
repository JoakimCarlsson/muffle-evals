I’ll check both implementations and their JSON methods, add SQL support using the existing code, then build and run the existing tests.

The change only needs methods on the two concrete implementations. Constructors and the `Set` interface can stay as they are; callers will be able to type-assert constructor results to either SQL interface. No fixtures or configuration need changes.

The existing JSON decoder adds elements, so `Scan` will decode into a temporary set before replacing the contents. This preserves the existing JSON behavior and leaves the set unchanged on errors.

Both set implementations now implement `driver.Valuer` and `sql.Scanner`.

- `Value` returns a JSON array as `[]byte`.
- `Scan` replaces contents from a string or byte slice.
- `Scan(nil)` empties the set.
- Unsupported types and invalid JSON return errors without changing contents.

Validation passed: `go build ./...` and `go test ./...`.
