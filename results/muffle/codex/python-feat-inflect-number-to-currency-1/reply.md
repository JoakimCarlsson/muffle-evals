I’ll check how `number_to_words` handles numbers, then add `number_to_currency` with focused tests for rounding and invalid inputs.

The method now rounds the input’s decimal text with half-up rounding, then uses `number_to_words` for the whole amount. It also preserves the sign for negative amounts below one dollar and uses its own decimal context so caller settings won’t change the result.

Added `engine.number_to_currency(num, andword="and")` with half-up rounding, two-digit cents, and `BadNumValueError` for invalid or non-finite inputs. Added documentation and regression tests.

Validation: 307 passed, 16 expected failures. Ruff wasn’t installed, so lint checks couldn’t run.
