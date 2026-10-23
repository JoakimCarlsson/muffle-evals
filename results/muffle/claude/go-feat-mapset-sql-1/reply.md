Both set types now implement `driver.Valuer` and `sql.Scanner`. The new test and the existing suite pass, and `go vet` is clean.

- **`Value()`** returns the set as a JSON array in a `[]byte`, in any order. An empty set gives `[]`.
- **`Scan(src)`** replaces the contents of the set with the JSON array in `src`, which can be a `string` or `[]byte`.
  - `Scan(nil)` empties the set.
  - Any other type, or invalid JSON, returns an error and leaves the set as it was.
- **Locking:** the thread-safe set takes its lock around both methods, so they are safe to call concurrently.

`Scan` clears the set before filling it, whereas the existing `UnmarshalJSON` adds to what is already there. I left `UnmarshalJSON` alone.

The changes are in `threadunsafe.go` and `threadsafe.go`. The new test, `sql_test.go`, covers both constructors with a type assertion to each interface, a round trip, string and `[]byte` input, `NULL`, the error cases, and the empty set. I haven't committed anything.
