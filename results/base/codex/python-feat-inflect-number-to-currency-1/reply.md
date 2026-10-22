I’ll check how `number_to_words` works, add `number_to_currency`, and test the formatting, rounding, and invalid inputs.

The method passes the requested examples and rounding cases, including the carry from `0.995` to `one and 00/100`. I’ve added documentation and tests for negative amounts, scientific notation, and low Decimal precision. I’ll run the full suite next.

Added `engine.number_to_currency(num, andword="and")` with half-up rounding, two-digit cents, and `BadNumValueError` for invalid or non-finite values.

Added documentation and regression tests. Full suite: **306 passed, 16 xfailed**. Ruff wasn’t installed, so lint checks couldn’t run.
