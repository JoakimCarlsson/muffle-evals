I’ll check `value_chain` and its tests, then make sure iteration errors propagate while non-iterable arguments still pass through as single values.

The fix now catches `TypeError` only when obtaining an iterator. Errors raised while consuming it propagate. The regression tests pass for both `map` and a generator, including failure before the first item; the full suite is running.

Fixed `value_chain` to catch `TypeError` only when obtaining an iterator. Errors raised during iteration now propagate, while non-iterable arguments still appear as single values.

Added regression tests for failing `map` and generator arguments. All 908 tests passed, with 5 skipped.
