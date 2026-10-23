Fixing duplicate line I added in test, then run tests.

Done. `value_chain` in `more_itertools/more.py` now calls `iter(value)` inside the `try`, so only a non-iterable argument is emitted as a single value. A `TypeError` raised while iterating now propagates. I added `test_lazy_type_error` in `tests/test_more.py`. The 6 `ValueChain` tests pass; I didn't run the rest of the suite. Nothing is committed.
