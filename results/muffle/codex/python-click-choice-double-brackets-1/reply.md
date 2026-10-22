I’ll check how argument metavars are formatted, fix the extra brackets, and add regression tests for Choice and DateTime.


Fixed optional arguments so an already bracketed type metavar doesn’t get another pair of brackets. Usage now shows `[foo|bar|baz]...` and `[%Y-%m-%d]`.

Added regression tests for Choice and DateTime, including required arguments.

Validation: 1,662 tests passed, 24 skipped, 1 expected failure.
