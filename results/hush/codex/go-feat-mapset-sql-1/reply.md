Set SQL support needs atomic scans. Checking implementations and tests.


Done.
Both sets support `driver.Valuer` and `sql.Scanner`; scans replace contents, clear NULL, preserve contents on errors. `go test -race ./...` passed.
