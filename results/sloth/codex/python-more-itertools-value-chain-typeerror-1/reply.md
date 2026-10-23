I’ll check `value_chain` and its tests, then narrow the exception handling so iteration errors propagate while non-iterable arguments remain single values.

The `try` block currently covers both obtaining the iterator and consuming it, so it catches errors from either step. The fix needs only the shared implementation and a regression test; callers, exports, type hints, fixtures, and configuration need no changes. I’ll preserve the existing scalar behavior and test errors both before and after items have been yielded.

Fixed `value_chain` to catch `TypeError` only when obtaining an iterator. Errors raised during iteration now propagate; non-iterable arguments still yield as single values.

Added regression coverage for maps and generators failing before or after yielding items.

Validation: 907 tests passed, 5 skipped. Package build was blocked by missing `pip` and `flit_core`.
