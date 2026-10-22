Done. Both set types now implement `Value` and `Scan`, with a type-assertion test in `sql_scan_test.go`. `go vet` and `go test` pass. I didn't run it against a real database driver.
