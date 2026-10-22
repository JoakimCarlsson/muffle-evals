I’ll check how `number_to_words` handles formatting and errors, then add the currency method using the existing conventions.

The change belongs in the engine class, its method listing, and a changelog entry. There are no separate exports or existing callers to update; the template function allowlist is outside the requested scope. I’ll reuse `number_to_words` for the whole amount and `Decimal` for rounding, without adding dependencies or options. Per the repository instructions, I’ll run existing tests without adding new ones.

Added `engine.number_to_currency` with half-up rounding, two-digit cents, and `BadNumValueError` for invalid or non-finite input.

Verified all supplied examples. Existing tests: **278 passed, 16 xfailed**.

Package build was blocked because the environment lacks both `build` and `pip`.
