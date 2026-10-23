Fixed: `value_chain` now raises the `TypeError` from a lazy argument instead of emitting the half-consumed object. I ran only the `value_chain` tests (6 passed), not the full suite.

The cause was that `value_chain` wrapped `yield from value` in a `try/except TypeError`. That caught errors raised partway through iteration as well as the "not iterable" case, so it yielded the exhausted `map`. It now calls `iter(value)` inside the `try`, and only a failure there makes the argument a single value. Arguments that aren't iterable at all are still emitted as-is, and errors while iterating now propagate. The change is in `more_itertools/more.py`.

I added `test_iteration_type_error` to `ValueChainTests` in `tests/test_more.py`, using your `map(len, ['ab', 'cde', 5])` example.

I haven't committed anything.
