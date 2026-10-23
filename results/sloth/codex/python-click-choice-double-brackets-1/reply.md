I’ll check how argument metavars are built and where they’re used, then make a focused fix and run the tests.

The extra brackets come from `Argument.make_metavar`, which adds an optional wrapper even when the type already supplies one. I’ll fix that shared method, covering help usage and error hints, and add a parameterized regression test. Type formatting, options, explicit metavars, and required arguments will stay unchanged; no config or export changes are needed.

Fixed optional argument formatting to reuse square brackets already supplied by `Choice` and `DateTime`, producing `[foo|bar|baz]...` as expected.

Added regression coverage for optional, variadic, required, and plain string arguments.

Validation: 1,665 tests passed; wheel build succeeded.
