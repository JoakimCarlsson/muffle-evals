I fixed `value_chain` in `more_itertools/more.py`. A `TypeError` raised while iterating an argument now reaches you instead of leaving the half-consumed object in the output.

The old code wrapped `yield from value` in the `try`, so any `TypeError` raised mid-iteration was caught and the argument was yielded as a single value. Now only `iter(value)` is inside the `try`. An argument that isn't iterable is still emitted as a single value, and strings and bytes are still emitted as-is.

I checked it on your example: `list(value_chain(map(len, ['ab', 5])))` now raises `TypeError: object of type 'int' has no len()`. `value_chain(1, [2, 3], 'ab')` still gives `[1, 2, 3, 'ab']`.

The doctests in `more.py` pass (113 passed, 1 skipped). The `-k value_chain` run selected no tests, so there are no unit tests for `value_chain` in `tests` to run. I didn't add a regression test since you didn't ask for one. I haven't committed anything.
