I added `p.number_to_currency(num, andword="and")` to the engine, and the full test suite passes, including the new tests.

It gives the outputs in your examples, including `2.675` → `68/100`, `2.674` → `67/100` and `Decimal("0.995")` → `'one and 00/100'`. `"ten"`, `"nan"`, `"inf"` and `float("inf")` raise `inflect.BadNumValueError`. So do `Decimal("NaN")`, `None` and an empty string, which I also checked by hand.

Floats are rounded from their printed form, which is how `2.675` gives `68/100`.

Negative amounts weren't in your spec. I chose "minus" in front, so `-5.5` gives `'minus five and 50/100'`. A negative amount that rounds to zero, like `-0.001`, gives `'zero and 00/100'`.

The method is in `inflect/__init__.py`, next to `number_to_words`. I also added `number_to_currency` to the module docstring's method list, a changelog entry at `newsfragments/+number-to-currency.feature.rst`, and tests in `tests/test_number_to_currency.py`.

I haven't committed anything.
