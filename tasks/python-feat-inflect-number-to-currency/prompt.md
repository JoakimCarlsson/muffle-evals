I use inflect to print checks, where the amount is written out in words with the cents as a fraction of one hundred, like "one hundred thousand and twenty and 56/100". `number_to_words` gets close, but its handling of decimals doesn't give me that format. I'd like a new method on the engine for this:

```python
>>> p = inflect.engine()
>>> p.number_to_currency(100_020.56)
'one hundred thousand and twenty and 56/100'
>>> p.number_to_currency(1234)
'one thousand, two hundred and thirty-four and 00/100'
>>> p.number_to_currency(0.07)
'zero and 07/100'
>>> p.number_to_currency("19.99")
'nineteen and 99/100'
>>> p.number_to_currency(101.01, andword="")
'one hundred one and 01/100'
```

Details:

- `number_to_currency(num, andword="and")` returns a string. `num` can be an int, a float, a `Decimal` or a numeric string.
- The whole amount is written like `number_to_words` writes it, and `andword` means the same as there. The "and" before the cents is always written, whatever `andword` is. The cents are always two digits.
- The amount is rounded half up to the nearest cent, going by the number as written, so `2.675` gives `68/100`, `2.674` gives `67/100`, and `Decimal("0.995")` gives `'one and 00/100'`.
- Anything that isn't a finite number, such as `"ten"`, `"nan"` or `"inf"`, raises `inflect.BadNumValueError`.

Please add this.
