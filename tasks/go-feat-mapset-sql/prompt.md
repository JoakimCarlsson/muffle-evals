Let sets be stored in and read from a database column.

I keep tags in a `mapset.Set[int]` / `mapset.Set[string]` and store them in a JSON column. Right now I have to marshal and unmarshal by hand around every query, because sets do not work with `database/sql`.

Please make both set implementations (the thread-safe one from `NewSet` and the one from `NewThreadUnsafeSet`) implement `driver.Valuer` and `sql.Scanner`, so the value returned by the constructors can be type-asserted to either interface:

- `Value() (driver.Value, error)` returns the set as a JSON array, as `[]byte` (for example `[1,2,3]` in any order).
- `Scan(src any) error` replaces the contents of the set with the JSON array in `src`, which can be a `string` or `[]byte`.
- `Scan(nil)` (a SQL `NULL`) empties the set.
- Scanning any other type, or invalid JSON, returns an error and leaves the set as it was.

Please add this.
