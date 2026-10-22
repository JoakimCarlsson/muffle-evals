I added `number_to_currency(num, andword="and")` to the engine in `inflect/__init__.py`. All your examples produce the outputs you listed. The existing tests pass (278 passed, 16 xfailed). I didn't write new tests, and `ruff` isn't installed here, so lint and format weren't checked.

- **Rounding:** it rounds half up to the cent from the number as written, so `2.675` gives `68/100`, `2.674` gives `67/100` and `Decimal("0.995")` gives `one and 00/100`.
- **Bad input:** `"ten"`, `"nan"`, `"inf"`, `float("inf")`, `Decimal("NaN")`, `""` and `" "` all raise `BadNumValueError`. I typed the argument as `Number | str` rather than `Word`, so an empty string raises `BadNumValueError`. With `Word` it would have raised a `TypeCheckError`.
- **Negatives:** you didn't specify these. They get a "minus" prefix, so `-0.07` gives `minus zero and 07/100`.
- **Changelog:** I added a news fragment at `newsfragments/+number-to-currency.feature.rst`.

I haven't committed anything.
