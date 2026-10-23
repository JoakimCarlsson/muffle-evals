Full jitter middleware will preserve stop signals and nonpositive waits.


Done.
Added `WithFullJitter`, docs, tests covering bounds, stop signals, nonpositive bases. `go test ./...` passed.
