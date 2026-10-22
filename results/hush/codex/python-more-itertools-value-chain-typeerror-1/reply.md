`value_chain` needs narrower `TypeError` handling. Checking implementation and tests.


Done.
`value_chain` catches `TypeError` only from `iter()`. Iteration errors propagate. Added map/generator regression tests. Tests: 907 passed, 5 skipped.
