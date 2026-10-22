Both set implementations now implement `driver.Valuer` and `sql.Scanner`, so the sets returned by `NewSet` and `NewThreadUnsafeSet` can be type-asserted to either interface. `go vet` and `go test` pass, including a new test in `sql_test.go` that covers both implementations.

- **`Value()`** returns the set as a JSON array in a `[]byte`, in any order. An empty set gives `[]`, not `null`.
- **`Scan(src)`** replaces the contents of the set with the JSON array in `src`, which can be a `string` or `[]byte`. `Scan(nil)` empties the set.
- **Errors:** any other type, invalid JSON, or elements of the wrong type (such as `["a"]` into a `Set[int]`) return an error and leave the set as it was.

`Scan` replaces the contents, which differs from the existing `UnmarshalJSON`: that one adds elements to the set.

The thread-safe set takes its read lock in `Value` and its write lock in `Scan`. The code is in `threadunsafe.go` and `threadsafe.go`. I haven't committed anything.
