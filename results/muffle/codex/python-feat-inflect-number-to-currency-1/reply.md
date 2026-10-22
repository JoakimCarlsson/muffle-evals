I’ll check how `number_to_words` works, add `number_to_currency` with decimal rounding, and run the relevant tests.

I’ll reuse `number_to_words` for the whole amount and convert the input’s string representation to `Decimal` for rounding. That gives `2.675` the requested half-up behavior and lets me reject invalid or non-finite values before formatting.

Added `engine.number_to_currency` with half-up decimal rounding, two-digit cents, `andword` support, and `BadNumValueError` for invalid or non-finite inputs.

Added documentation and tests. Full suite: **307 passed, 16 xfailed**. Ruff was unavailable.
