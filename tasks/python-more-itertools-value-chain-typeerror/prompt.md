`value_chain` swallows a `TypeError` that is raised while it is iterating one of its arguments. Instead of the exception reaching me, the half-consumed object itself shows up in the output after the items it already produced:

```python
>>> from more_itertools import value_chain
>>> list(value_chain(map(len, ['ab', 'cde', 5])))
[2, 3, <map object at 0x104c6e530>]
```

The `TypeError: object of type 'int' has no len()` never reaches me, and the trailing item is the exhausted `map` object, which carries no data. `itertools.chain` and `more_itertools.always_iterable` both raise the `TypeError` on the same input:

```python
>>> list(chain(map(len, ['ab', 'cde', 5])))
TypeError: object of type 'int' has no len()
>>> list(always_iterable(map(len, ['ab', 'cde', 5])))
TypeError: object of type 'int' has no len()
```

Any lazy argument (a generator, a `map`, a file-backed iterator) can hit this, so a real bug in my own code gets reported as a stray object in the output instead of as an exception. Arguments that are not iterable at all should of course still be emitted as single values, as documented.

Please fix this.
