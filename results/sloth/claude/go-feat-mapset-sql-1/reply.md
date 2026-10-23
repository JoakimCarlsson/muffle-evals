Both set types now implement `driver.Valuer` and `sql.Scanner`, so you can type-assert the value returned by `NewSet` or `NewThreadUnsafeSet` to either interface. Build, vet and the full test suite pass, including the new test.

- **`Value()`** returns the set as a JSON array of `[]byte`, in no particular order.
- **`Scan(src)`** replaces the contents of the set. It accepts a `string` or `[]byte`, and `nil` empties the set. Any other type or invalid JSON returns an error and leaves the set as it was.
- **Thread safety:** the thread-safe set locks around `Value` and `Scan`, as it does for its JSON methods.

I added `TestSQLValuerScanner` to `threadunsafe_test.go`. It runs both implementations through round-trip, `string`, `[]byte`, `nil`, wrong-type and invalid-JSON cases.

I did not add these methods to the `Set` interface, so existing external implementations keep compiling. That means you reach them by type assertion rather than directly on `Set[T]`. The code is in `threadunsafe.go` and `threadsafe.go`.

I haven't committed anything.
