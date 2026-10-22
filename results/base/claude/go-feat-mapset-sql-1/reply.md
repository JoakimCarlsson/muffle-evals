Empty set marshals to `[]`. Good. Implementing.

My test mixes set kinds (Equal panics across types); fix the test to use the same kind.

Both set types now implement `driver.Valuer` and `sql.Scanner`, so `NewSet` and `NewThreadUnsafeSet` values can be type-asserted to either interface. `go vet` is clean and `go test ./...` passes.

- **`Value()`** returns the set as a JSON array in a `[]byte`, in any order. An empty set gives `[]`.
- **`Scan(src)`** accepts a `string` or `[]byte` and replaces the set's contents with the decoded array.
- **`Scan(nil)`** empties the set.
- **Errors:** any other type, or invalid JSON, returns an error and leaves the set unchanged. The JSON is decoded before the set is cleared, so a failed scan can't half-apply.
- **Thread safety:** the thread-safe set takes its read lock in `Value` and its write lock in `Scan`.

The changes are in `threadunsafe.go` and `threadsafe.go`, with a new test in `sql_test.go`. The test covers both set types with a round trip through bytes, a string scan, the two error cases leaving the set unchanged, and a `nil` scan.

I didn't add the methods to the `Set` interface, since you only asked for type assertion. The existing `UnmarshalJSON` appends to the set rather than replacing it, so I didn't reuse it for `Scan`.

I haven't committed anything.
