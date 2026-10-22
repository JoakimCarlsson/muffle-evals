`value_chain` now lets a `TypeError` raised while iterating an argument reach you. Your example `list(value_chain(map(len, ['ab', 'cde', 5])))` now raises `TypeError: object of type 'int' has no len()`. I ran the `ValueChain` tests and they pass. I did not run the full suite. The doctest run failed on a relative-import error, so the docstring examples are unchecked.

The cause was that `value_chain` wrapped `yield from value` in the `try/except TypeError`, so errors from inside the iteration were caught as if the argument weren't iterable. The fix, in `more_itertools/more.py`, calls `iter(value)` inside the `try` and does the `yield from` outside it. Arguments that really aren't iterable, such as `4`, are still emitted as single values.

I added `test_error_while_iterating` to `ValueChainTests` in `tests/test_more.py`, using your example. I haven't committed anything.
