I've added `engine.number_to_currency(num, andword="and")`, and the full suite passes (284 passed, 16 xfailed). All five of your examples give exactly the output you listed. I couldn't run `ruff` because it isn't installed here, so lint and format are unchecked.

- **Rounding:** it rounds half up using the number as written, so `2.675` gives `68/100`, `2.674` gives `67/100` and `Decimal("0.995")` gives `'one and 00/100'`.
- **Errors:** `"ten"`, `"nan"`, `"inf"`, `"-inf"`, an empty or blank string, and complex numbers like `1j` all raise `inflect.BadNumValueError`.
- **Large amounts:** these keep their full precision. `1e30` gives `one nonillion and 00/100`.

Your spec didn't cover negative amounts, so I added `minus ` in front, as `number_to_words` does. `-0.5` gives `minus zero and 50/100`. An amount that rounds to zero, like `-0.001`, gives `zero and 00/100` with no minus.

I typed `num` as `Number | str` rather than reusing `Word`, because `Word` rejects an empty string with a `TypeCheckError` instead of `BadNumValueError`.

I also added a test class in `tests/test_numwords.py` and a changelog entry at `newsfragments/+number-to-currency.feature.rst`. I haven't committed anything.
