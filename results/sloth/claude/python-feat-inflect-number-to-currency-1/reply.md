Fixing an edge case: an empty string fails the `Word` type check, but it should raise `BadNumValueError`.

I added `p.number_to_currency(num, andword="and")` in `inflect/__init__.py`. The full test suite passes (269 passed, 16 xfailed). `ruff` isn't installed here, so I haven't run lint or the format check.

I checked all five of your examples, plus `2.675`, `2.674` and `Decimal("0.995")`. They give the strings you listed.

- **Rounding:** the amount is rounded half up to the cent, going by the number as written. `2.675` is read as exactly `2.675` (not the binary float), so it gives `68/100`.
- **Non-numbers:** `"ten"`, `"nan"`, `"inf"`, `"-inf"`, `""`, a float NaN and `Decimal("Infinity")` all raise `BadNumValueError`.
- **Negatives:** `-0.5` gives `'minus zero and 50/100'`. You didn't specify this case, so say if you want something different.
- **Large amounts:** `10**30` works.
- **Type check:** `num` is annotated `Number | str` rather than `Number | Word`, because `Word` rejects the empty string before it could raise `BadNumValueError`.

I also added a `test_number_to_currency` test in `tests/test_numwords.py`, a changelog entry in `newsfragments/+number-to-currency.feature.rst`, and `number_to_currency` to the module docstring's function list. Nothing is committed.
