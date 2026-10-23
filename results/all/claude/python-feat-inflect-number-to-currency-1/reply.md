Fixing the cents calculation for huge numbers: `%` hits the default 28-digit precision.

Done. I added `engine.number_to_currency` in `inflect/__init__.py`, with tests in `tests/test_numwords.py` and a newsfragment. The full suite passes (276 passed, 16 xfailed), and every example from your request is in the tests. `ruff` isn't installed here, so lint and format weren't run.

- **Negatives:** `-0.5` gives `'minus zero and 50/100'`. You didn't specify this, so I chose it.
- **Empty string:** `""` raises `BadNumValueError`. `number_to_words` can't take an empty string, so the empty case is only handled here.
