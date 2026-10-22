Currency conversion needs decimal half-up rounding; checking engine code and tests.


Done.
Added `number_to_currency` with half-up rounding, two-digit cents, custom `andword`, invalid-number errors. Tests: 304 passed, 16 xfailed. Ruff unavailable.
