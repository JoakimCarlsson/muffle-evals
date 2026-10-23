Test bug: `Equal` needs same set type. Fixing the test to build expected sets with the matching constructor.

Done. Both set types now implement `driver.Valuer` and `sql.Scanner`, in `threadunsafe.go` and `threadsafe.go`. I added `TestSQLValuerScanner` to `set_test.go`. Vet and the full test suite pass.

`Scan` replaces the set contents. A bad type or bad JSON returns an error and leaves the set unchanged.
