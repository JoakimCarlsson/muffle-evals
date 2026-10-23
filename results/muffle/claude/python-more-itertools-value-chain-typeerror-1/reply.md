Only the `iter()` call should be guarded.

I fixed `value_chain` in `more_itertools/more.py` so a `TypeError` raised while iterating an argument now reaches you. Your example `list(value_chain(map(len, ['ab', 'cde', 5])))` should now raise `TypeError: object of type 'int' has no len()`, like `itertools.chain` does. I didn't run that exact line. The new regression test covers the same case, and the 6 `ValueChain` tests pass.

The old code wrapped `yield from value` in the `try/except TypeError`, so it also caught errors raised mid-iteration and yielded the half-consumed object. It now catches `TypeError` only around `iter(value)`. Arguments that aren't iterable are still emitted as single values, and strings and bytes are unchanged.

The regression test is `test_error_while_iterating` in `tests/test_more.py`. I only ran the `ValueChain` tests, not the full suite. I also tried running the module doctests, but that failed with a relative-import error, so they weren't checked.
