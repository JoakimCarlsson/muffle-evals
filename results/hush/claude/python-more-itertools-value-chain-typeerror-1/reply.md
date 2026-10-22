Fix: call `iter()` first, so only non-iterables are emitted as values.

Done. `value_chain` in `more_itertools/more.py` now catches `TypeError` only from `iter(value)`, so errors raised mid-iteration reach you. Your `map` example now raises, and non-iterables are still emitted as single values. I added no regression test, and `-k value_chain` selected none of the existing tests, so the suite wasn't run.
