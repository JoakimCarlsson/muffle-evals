I’ll check `value_chain` and its tests, then adjust it so iteration errors propagate while non-iterable arguments remain single values.

Fixed `value_chain` to catch `TypeError` only when obtaining an iterator. Errors raised during iteration now propagate; non-iterable arguments still yield as single values.

Added regression coverage for failures before and after yielding items. All 907 tests pass (5 skipped).
