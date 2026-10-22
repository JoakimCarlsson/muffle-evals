Both set types now implement `driver.Valuer` and `sql.Scanner`, so the value from `NewSet` or `NewThreadUnsafeSet` can be type-asserted to either interface. The build, vet and existing tests pass. I also ran a throwaway test covering Scan, Value and `Scan(nil)` on both types. I deleted it afterwards, so no test for this is left in the repo.

- **`Value()`** returns the set as a JSON array in a `[]byte`. It reuses the existing `MarshalJSON`.
- **`Scan(src)`** accepts a `string` or `[]byte` and replaces the set's contents with the decoded array.
- **`Scan(nil)`** empties the set.
- **Errors:** any other type, or invalid JSON, returns an error and leaves the set as it was. It decodes first and only clears the set once the JSON is valid.
- **Thread-safe set:** `Value` takes the read lock and `Scan` takes the write lock.

The changes are in `threadunsafe.go` and `threadsafe.go`. I didn't add tests or a README note, since you didn't ask for them.
