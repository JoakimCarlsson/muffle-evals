I’ll check how the 405 handler builds `Allow`, fix the duplicate methods, and add a regression test for the overlapping routes.

The shared 405 handler now adds each method once, preserving its first occurrence. The regression test covers your four overlapping POST routes and checks that a distinct PUT method is still included. The build and full test suite are running.

Fixed the shared 405 handler so each method appears only once in `Allow`.

Added regression coverage for your overlapping POST routes and for retaining a distinct PUT method.

Passed: `go build ./... && go test ./...`.

No unrelated changes; race tests were not run.
