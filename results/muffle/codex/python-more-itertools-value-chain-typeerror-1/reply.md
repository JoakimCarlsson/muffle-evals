I’ll check `value_chain` and its tests, then separate iterable detection from iteration so errors raised during iteration propagate.

Fixed `value_chain` to catch `TypeError` only when calling `iter()` on an argument. Errors raised during iteration now propagate; non-iterable arguments still yield as single values.

Added regression tests for the reported `map` case and a generator error. All 908 tests passed, with 5 skipped.
