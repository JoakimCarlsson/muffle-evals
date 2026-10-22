Fix: check iterability with `iter()` before yielding from it, so only the non-iterable check is guarded.

I fixed `value_chain` so a `TypeError` raised while it iterates an argument now reaches you. Your `map(len, ['ab', 'cde', 5])` example now raises `TypeError: object of type 'int' has no len()`.

The old code wrapped the whole `yield from value` in `try/except TypeError`. That caught errors raised partway through iteration as well as the "not iterable" case, and then yielded the half-consumed object. Now only the `iter(value)` call is guarded (`more_itertools/more.py`). Arguments that aren't iterable are still emitted as single values, and strings and bytes are still emitted as-is.

I added a regression test, `test_iteration_type_error`, in `tests/test_more.py`. The six `ValueChain` tests pass, and so do the doctests in `more.py`. I didn't run the rest of the test suite.

I made no commit.
