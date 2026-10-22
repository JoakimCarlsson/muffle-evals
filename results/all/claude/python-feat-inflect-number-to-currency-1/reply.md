Done. `number_to_currency` added in `inflect/__init__.py`, plus `newsfragments/+number-to-currency.feature.rst`. All your examples match, bad input raises `BadNumValueError`, and existing tests pass. I added no new tests.

Negative amounts come out as "minus five and 50/100".
