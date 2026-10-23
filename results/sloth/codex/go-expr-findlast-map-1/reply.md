I’ll trace how the reverse-search builtins use the VM stack, fix the shared cause, and add regression coverage in the existing tests.

The shared reverse-loop compiler leaves its loop-condition boolean on the stack on every iteration and at exhaustion. That corrupts map construction. The fix belongs in that helper, which serves both builtins and optimized `last(filter(...))` expressions. I’ll add map-value cases for matches, no match, and empty input; no API, VM, or configuration changes are needed.

The stack fix is in place. One new test hit an existing test-harness quirk: it prints and reparses expressions, turning `5.0` into integer `5`. I changed that test value to `5.5` to preserve its type through the round trip.

`go build ./...` also encountered a `main` package with no `main` function. I’m checking the library build separately and rerunning the full test suite.

Fixed the shared reverse-loop compiler to discard its condition booleans, preventing stack corruption in map literals.

Regression coverage includes both builtins, match boundaries, no matches, empty input, and optimized `last(filter(...))`.

Validation: `go test ./...` and `go build .` pass. `go build ./...` hits an existing `main` package without a `main` function.
