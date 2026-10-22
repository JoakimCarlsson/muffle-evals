I’ll check `value_chain` and its callers, then narrow the exception handling so iteration errors reach the caller while non-iterable arguments still work.

The fix only needs to reach `value_chain` in `more_itertools/more.py`. There are no internal callers to update, and the existing tests, exports, type signature, and documentation remain applicable. I’ll catch `TypeError` only when calling `iter(value)`; errors raised while consuming that iterator will then propagate.

Fixed `value_chain` to catch `TypeError` only when obtaining an iterator. Errors raised during iteration now propagate; non-iterable arguments still yield as single values.

Verified your reproduction and scalar behavior. Existing suite passed: 906 tests, 5 skipped.

Package build couldn’t run because the environment lacks `build` and `pip`.
