Checking an empty string, which the `Word` type rejects. I'll loosen the annotation so it raises `BadNumValueError`.

I added `p.number_to_currency(num, andword="and")` in `inflect/__init__.py`. All your examples give the outputs you listed, and the full suite passes with the new tests.

- **Rounding:** it goes by the number as written, so `2.675` gives `68/100` and `2.674` gives `67/100`. `Decimal("0.995")` gives `'one and 00/100'`.
- **Bad input:** `"ten"`, `"nan"`, `"inf"`, `float("inf")` and `""` raise `inflect.BadNumValueError`. So does an absurdly large value like `"1e999999999"`.
- **Negative amounts:** you didn't specify these. `-1.5` gives `'minus one and 50/100'`. A negative that rounds to zero, like `-0.001`, gives `'zero and 00/100'` rather than "minus zero".

I also added tests in `tests/test_currency.py`, a README section and method-list entry, and a newsfragment at `newsfragments/+number-to-currency.feature.rst`.

I couldn't run `ruff` because it isn't installed here, so the formatting is unchecked. I haven't committed anything.
