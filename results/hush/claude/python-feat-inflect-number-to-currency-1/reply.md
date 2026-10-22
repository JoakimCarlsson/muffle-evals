Need path; also add tests.

Done. I added `number_to_currency` in `inflect/__init__.py`, tests in `tests/test_numwords.py`, and a newsfragment. The full suite passes.

- **Empty string:** `""` raises a typeguard error rather than `BadNumValueError`, because the `Word` type rejects it, as in `number_to_words`.
- **Negatives:** I added this one myself. Negative amounts get a "minus" prefix, so `-5.5` gives `minus five and 50/100`. An amount that rounds to zero has no sign.
- **Not committed:** nothing is committed.
