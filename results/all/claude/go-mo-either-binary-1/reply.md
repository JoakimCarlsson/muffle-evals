Now tests.

Done. Added the four methods to `Either3`, `Either4` and `Either5`, plus a gob round-trip test for each; `go test .` passes. The tests check `assert.Equal` rather than `Equal`, because these types have no `Equal` method.
