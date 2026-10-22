Done. `value_chain` in `more_itertools/more.py` now calls `iter(value)` inside the `try`, so only non-iterable arguments are emitted as single values. Errors raised during iteration now propagate.

I confirmed your `map` example now raises `TypeError: object of type 'int' has no len()`. Plain scalars and lists still behave as before. The `-k value_chain` pytest run selected no tests, so I didn't run the existing suite.
