I’ll check the existing conversion code and tests, then add the method using decimal half-up rounding and the current word formatting.

The change needs the engine method, its API documentation, and tests in the existing number-conversion test file. I’ll reuse `number_to_words` for the whole amount and leave its callers and formatting options unchanged.

All 302 tests passed, with 16 expected failures. The tests cover your examples, invalid values, rounding across a whole-number boundary, and reduced decimal precision. The environment lacks `build` and `ruff`; I’m checking whether `uv` can run those final checks.

Added `engine.number_to_currency(num, andword="and")` with half-up rounding, two-digit cents, and `BadNumValueError` for invalid or non-finite values. Included documentation and tests for your examples and edge cases.

Validation: 302 tests passed, 16 expected failures; lint, formatting, and package build passed.
