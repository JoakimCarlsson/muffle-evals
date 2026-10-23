`value_chain` must catch `TypeError` from `iter()`, then let iteration errors propagate.

Done.
`value_chain` now propagates iteration errors; noniterables remain single values. Regression tests added. Suite: 908 tests, 5 skipped.
