# python-feat-inflect-number-to-currency

Source: https://github.com/jaraco/inflect/pull/284

## Prompt

> I use inflect to print checks, where the amount is written out in words with the cents as a fraction of one hundred, like "one hundred thousand and twenty and 56/100". `number_to_words` gets close, but its handling of decimals doesn't give me that format. I'd like a new method on the engine for this:
> 
> ```python
> >>> p = inflect.engine()
> >>> p.number_to_currency(100_020.56)
> 'one hundred thousand and twenty and 56/100'
> >>> p.number_to_currency(1234)
> 'one thousand, two hundred and thirty-four and 00/100'
> >>> p.number_to_currency(0.07)
> 'zero and 07/100'
> >>> p.number_to_currency("19.99")
> 'nineteen and 99/100'
> >>> p.number_to_currency(101.01, andword="")
> 'one hundred one and 01/100'
> ```
> 
> Details:
> 
> - `number_to_currency(num, andword="and")` returns a string. `num` can be an int, a float, a `Decimal` or a numeric string.
> - The whole amount is written like `number_to_words` writes it, and `andword` means the same as there. The "and" before the cents is always written, whatever `andword` is. The cents are always two digits.
> - The amount is rounded half up to the nearest cent, going by the number as written, so `2.675` gives `68/100`, `2.674` gives `67/100`, and `Decimal("0.995")` gives `'one and 00/100'`.
> - Anything that isn't a finite number, such as `"ten"`, `"nan"` or `"inf"`, raises `inflect.BadNumValueError`.
> 
> Please add this.

## Upstream change (tests left out)

Files: [README.rst](../../tasks/python-feat-inflect-number-to-currency/upstream/README.rst), [inflect/__init__.py](../../tasks/python-feat-inflect-number-to-currency/upstream/inflect/__init__.py), [newsfragments/213.feature.rst](../../tasks/python-feat-inflect-number-to-currency/upstream/newsfragments/213.feature.rst), [tests/test_numwords.py](../../tasks/python-feat-inflect-number-to-currency/upstream/tests/test_numwords.py)

```diff
diff --git a/README.rst b/README.rst
index 2799b7f..12fedb8 100644
--- a/README.rst
+++ b/README.rst
@@ -55,7 +55,7 @@ Methods
 - ``compare``, ``compare_nouns``, ``compare_nouns``, ``compare_adjs``
 - ``a``, ``an``
 - ``present_participle``
-- ``ordinal``, ``number_to_words``
+- ``ordinal``, ``number_to_words``, ``number_to_currency``
 - ``join``
 - ``inflect``, ``classical``, ``gender``
 - ``defnoun``, ``defverb``, ``defadj``, ``defa``, ``defan``
@@ -245,6 +245,17 @@ Above provided threshold, numerals will remain numerals
     >>> p.number_to_words(1000, threshold=10)
     '1,000'
 
+Write an Amount as on a Check
+^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+The cents are written as a fraction of one hundred.
+
+.. code-block:: python
+
+    >>> p.number_to_currency(100_020.56)
+    'one hundred thousand and twenty and 56/100'
+    >>> p.number_to_currency(1234.5, andword="")
+    'one thousand, two hundred thirty-four and 50/100'
+
 Join Words into a List
 ^^^^^^^^^^^^^^^^^^^^^^
 
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..500b5be 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -14,7 +14,7 @@ methods:
     compare compare_nouns compare_verbs compare_adjs
     present_participle
     ordinal
-    number_to_words
+    number_to_words number_to_currency
     join
     defnoun defverb defadj defa defan
 
@@ -36,7 +36,7 @@ ARTICLES:
     classical inflect num a an
 
 NUMERICAL:
-    ordinal number_to_words
+    ordinal number_to_words number_to_currency
 
 USER_DEFINED:
     defnoun defverb defadj defa defan
@@ -61,7 +61,7 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
-from decimal import Decimal
+from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
 from numbers import Number
 from re import Match
 from typing import (
@@ -4062,6 +4062,30 @@ class engine:
                 yield comma
             yield f" {nc}"
 
+    @typechecked
+    def number_to_currency(self, num: Number | Word, andword: str = "and") -> str:
+        """
+        Return an amount in words, with the cents written as a fraction
+        of one hundred, as on checks and money orders.
+
+        The amount is rounded half up to the nearest cent.
+
+        andword: word for 'and' in the whole amount, as in number_to_words.
+            The 'and' before the cents is always written.
+
+        >>> number_to_currency = engine().number_to_currency
+        >>> number_to_currency(100_020.56)
+        'one hundred thousand and twenty and 56/100'
+        >>> number_to_currency(120, andword="")
+        'one hundred twenty and 00/100'
+        """
+        try:
+            amount = Decimal(str(num)).quantize(Decimal("0.01"), ROUND_HALF_UP)
+            whole, cents = format(amount, "f").split(".")
+        except (InvalidOperation, ValueError) as err:
+            raise BadNumValueError from err
+        return f"{self.number_to_words(whole, andword=andword)} and {cents}/100"
+
     @typechecked
     def join(
         self,
diff --git a/newsfragments/213.feature.rst b/newsfragments/213.feature.rst
new file mode 100644
index 0000000..f4bd0fc
--- /dev/null
+++ b/newsfragments/213.feature.rst
@@ -0,0 +1 @@
+Added ``number_to_currency``, which writes an amount in words with the cents as a fraction of one hundred, as on checks and money orders (``number_to_currency(100020.56)`` is ``"one hundred thousand and twenty and 56/100"``).
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +31/-1 | 29 | 3,992 | $0.124 |
| claude | muffle | pass | +34/-2 | 33 | 4,061 | $0.105 |
| claude | hush | pass | +33/-1 | 28 | 3,362 | $0.109 |
| claude | sloth | pass | +30/-1 | 0 | 2,634 | $0.056 |
| claude | all | pass | +29/-3 | 0 | 2,823 | $0.092 |
| codex | base | pass | +48/-1 | 57 | 2,271 | - |
| codex | muffle | pass | +46/-1 | 67 | 2,212 | - |
| codex | hush | pass | +26/-1 | 50 | 1,453 | - |
| codex | sloth | pass | +26/-3 | 0 | 1,570 | - |
| codex | all | pass | +23/-3 | 0 | 1,527 | - |

### claude, base: pass

Files: [inflect/__init__.py](../base/claude/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [newsfragments/+number-to-currency.feature.rst](../base/claude/python-feat-inflect-number-to-currency-1/files/newsfragments/+number-to-currency.feature.rst), [tests/test_numwords.py](../base/claude/python-feat-inflect-number-to-currency-1/files/tests/test_numwords.py)

<details><summary>diff</summary>

```diff
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..8cba484 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -61,7 +61,8 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
-from decimal import Decimal
+from decimal import ROUND_HALF_UP, Decimal
+from decimal import localcontext as decimal_context
 from numbers import Number
 from re import Match
 from typing import (
@@ -4050,6 +4051,34 @@ class engine:
         )
         return signout + valout
 
+    @typechecked
+    def number_to_currency(self, num: Number | str, andword: str = "and") -> str:
+        """
+        Return an amount as check-style words, with the cents as a fraction
+        of one hundred, e.g. "one hundred and twenty and 56/100".
+
+        The amount is rounded half up to the nearest cent, going by the
+        number as written. Non-finite or non-numeric input raises
+        BadNumValueError.
+
+        andword: as for number_to_words (the "and" before the cents is
+        always written).
+        """
+        try:
+            value = Decimal(str(num))
+        except ArithmeticError as err:
+            raise BadNumValueError from err
+        if not value.is_finite():
+            raise BadNumValueError
+
+        with decimal_context() as ctx:
+            ctx.prec = max(28, len(value.as_tuple().digits), value.adjusted() + 10)
+            cents = abs(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
+            whole, frac = divmod(int(cents.scaleb(2)), 100)
+        words = self.number_to_words(str(whole), andword=andword)
+        sign = "minus " if value < 0 and (whole or frac) else ""
+        return f"{sign}{words} and {frac:02d}/100"
+
     @staticmethod
     def _render(chunks, decimal, comma):
         first_item = chunks.pop(0)
diff --git a/newsfragments/+number-to-currency.feature.rst b/newsfragments/+number-to-currency.feature.rst
new file mode 100644
index 0000000..69b1775
--- /dev/null
+++ b/newsfragments/+number-to-currency.feature.rst
@@ -0,0 +1 @@
+Added ``number_to_currency`` to write an amount as check-style words with the cents as a fraction of 100, e.g. "one hundred and twenty and 56/100".
diff --git a/tests/test_numwords.py b/tests/test_numwords.py
index 178a755..280473f 100644
--- a/tests/test_numwords.py
+++ b/tests/test_numwords.py
@@ -1,3 +1,5 @@
+import decimal
+
 import pytest
 
 import inflect
@@ -472,3 +474,30 @@ def test_issue_217():
         p.number_to_words("1234567", group=3)
         == "one, two thirty-four, five sixty-seven"
     )
+
+
+class TestNumberToCurrency:
+    @pytest.mark.parametrize(
+        'num, expected',
+        [
+            (100_020.56, 'one hundred thousand and twenty and 56/100'),
+            (1234, 'one thousand, two hundred and thirty-four and 00/100'),
+            (0.07, 'zero and 07/100'),
+            ("19.99", 'nineteen and 99/100'),
+            (2.675, 'two and 68/100'),
+            (2.674, 'two and 67/100'),
+            (decimal.Decimal("0.995"), 'one and 00/100'),
+            (-0.5, 'minus zero and 50/100'),
+        ],
+    )
+    def test_amounts(self, num, expected):
+        assert inflect.engine().number_to_currency(num) == expected
+
+    def test_andword(self):
+        p = inflect.engine()
+        assert p.number_to_currency(101.01, andword="") == 'one hundred one and 01/100'
+
+    @pytest.mark.parametrize('bad', ["ten", "nan", "inf", "-inf", "", " ", "1j"])
+    def test_bad(self, bad):
+        with pytest.raises(inflect.BadNumValueError):
+            inflect.engine().number_to_currency(bad)
```

</details>

<details><summary>reply</summary>

I've added `engine.number_to_currency(num, andword="and")`, and the full suite passes (284 passed, 16 xfailed). All five of your examples give exactly the output you listed. I couldn't run `ruff` because it isn't installed here, so lint and format are unchecked.

- **Rounding:** it rounds half up using the number as written, so `2.675` gives `68/100`, `2.674` gives `67/100` and `Decimal("0.995")` gives `'one and 00/100'`.
- **Errors:** `"ten"`, `"nan"`, `"inf"`, `"-inf"`, an empty or blank string, and complex numbers like `1j` all raise `inflect.BadNumValueError`.
- **Large amounts:** these keep their full precision. `1e30` gives `one nonillion and 00/100`.

Your spec didn't cover negative amounts, so I added `minus ` in front, as `number_to_words` does. `-0.5` gives `minus zero and 50/100`. An amount that rounds to zero, like `-0.001`, gives `zero and 00/100` with no minus.

I typed `num` as `Number | str` rather than reusing `Word`, because `Word` rejects an empty string with a `TypeCheckError` instead of `BadNumValueError`.

I also added a test class in `tests/test_numwords.py` and a changelog entry at `newsfragments/+number-to-currency.feature.rst`. I haven't committed anything.

</details>

### claude, muffle: pass

Files: [inflect/__init__.py](../muffle/claude/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [newsfragments/+number-to-currency.feature.rst](../muffle/claude/python-feat-inflect-number-to-currency-1/files/newsfragments/+number-to-currency.feature.rst), [tests/test_number_to_currency.py](../muffle/claude/python-feat-inflect-number-to-currency-1/files/tests/test_number_to_currency.py)

<details><summary>diff</summary>

```diff
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..b9a195b 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -36,7 +36,7 @@ ARTICLES:
     classical inflect num a an
 
 NUMERICAL:
-    ordinal number_to_words
+    ordinal number_to_words number_to_currency
 
 USER_DEFINED:
     defnoun defverb defadj defa defan
@@ -61,7 +61,7 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
-from decimal import Decimal
+from decimal import ROUND_HALF_UP, Decimal, localcontext
 from numbers import Number
 from re import Match
 from typing import (
@@ -3930,6 +3930,37 @@ class engine:
     def _get_sign(num):
         return {'+': 'plus', '-': 'minus'}.get(num.lstrip()[0], '')
 
+    def number_to_currency(self, num: Number | str, andword: str = "and") -> str:
+        """
+        Return an amount in words with the cents as a fraction of one hundred,
+        as written on a check.
+
+        >>> p = engine()
+        >>> p.number_to_currency(100_020.56)
+        'one hundred thousand and twenty and 56/100'
+
+        The amount is rounded half up to the nearest cent, going by the number
+        as written. andword is used within the whole amount as in
+        number_to_words; the "and" before the cents is always written.
+
+        Raises BadNumValueError if num is not a finite number.
+        """
+        try:
+            amount = Decimal(num if isinstance(num, (int, Decimal)) else str(num))
+        except (ArithmeticError, ValueError, TypeError) as err:
+            raise BadNumValueError from err
+        if not amount.is_finite():
+            raise BadNumValueError
+        with localcontext() as ctx:
+            ctx.prec = max(ctx.prec, len(amount.as_tuple().digits) + 10)
+            amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
+            cents = int(abs(amount) * 100) % 100
+            whole = int(amount)
+        words = self.number_to_words(whole, andword=andword)
+        if amount < 0 and whole == 0:
+            words = f"minus {words}"
+        return f"{words} and {cents:02d}/100"
+
     @typechecked
     def number_to_words(  # noqa: C901
         self,
diff --git a/newsfragments/+number-to-currency.feature.rst b/newsfragments/+number-to-currency.feature.rst
new file mode 100644
index 0000000..f3ff6bd
--- /dev/null
+++ b/newsfragments/+number-to-currency.feature.rst
@@ -0,0 +1 @@
+Added ``engine.number_to_currency``, which writes an amount in words with the cents as a fraction of one hundred, as on a check.
diff --git a/tests/test_number_to_currency.py b/tests/test_number_to_currency.py
new file mode 100644
index 0000000..1c161f6
--- /dev/null
+++ b/tests/test_number_to_currency.py
@@ -0,0 +1,33 @@
+from decimal import Decimal
+
+import pytest
+
+import inflect
+
+
+@pytest.mark.parametrize(
+    'num, expected',
+    [
+        (100_020.56, 'one hundred thousand and twenty and 56/100'),
+        (1234, 'one thousand, two hundred and thirty-four and 00/100'),
+        (0.07, 'zero and 07/100'),
+        ("19.99", 'nineteen and 99/100'),
+        (2.675, 'two and 68/100'),
+        (2.674, 'two and 67/100'),
+        (Decimal("0.995"), 'one and 00/100'),
+        (-5.5, 'minus five and 50/100'),
+    ],
+)
+def test_number_to_currency(num, expected):
+    assert inflect.engine().number_to_currency(num) == expected
+
+
+def test_number_to_currency_andword():
+    p = inflect.engine()
+    assert p.number_to_currency(101.01, andword="") == 'one hundred one and 01/100'
+
+
+@pytest.mark.parametrize('num', ["ten", "nan", "inf", float("inf"), Decimal("NaN")])
+def test_number_to_currency_bad(num):
+    with pytest.raises(inflect.BadNumValueError):
+        inflect.engine().number_to_currency(num)
```

</details>

<details><summary>reply</summary>

I added `p.number_to_currency(num, andword="and")` to the engine, and the full test suite passes, including the new tests.

It gives the outputs in your examples, including `2.675` → `68/100`, `2.674` → `67/100` and `Decimal("0.995")` → `'one and 00/100'`. `"ten"`, `"nan"`, `"inf"` and `float("inf")` raise `inflect.BadNumValueError`. So do `Decimal("NaN")`, `None` and an empty string, which I also checked by hand.

Floats are rounded from their printed form, which is how `2.675` gives `68/100`.

Negative amounts weren't in your spec. I chose "minus" in front, so `-5.5` gives `'minus five and 50/100'`. A negative amount that rounds to zero, like `-0.001`, gives `'zero and 00/100'`.

The method is in `inflect/__init__.py`, next to `number_to_words`. I also added `number_to_currency` to the module docstring's method list, a changelog entry at `newsfragments/+number-to-currency.feature.rst`, and tests in `tests/test_number_to_currency.py`.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [inflect/__init__.py](../hush/claude/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [newsfragments/+number-to-currency.feature.rst](../hush/claude/python-feat-inflect-number-to-currency-1/files/newsfragments/+number-to-currency.feature.rst), [tests/test_numwords.py](../hush/claude/python-feat-inflect-number-to-currency-1/files/tests/test_numwords.py)

<details><summary>diff</summary>

```diff
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..c99ad13 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -61,7 +61,8 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
-from decimal import Decimal
+import decimal as decimal_module
+from decimal import ROUND_HALF_UP, Decimal
 from numbers import Number
 from re import Match
 from typing import (
@@ -4050,6 +4051,36 @@ class engine:
         )
         return signout + valout
 
+    @typechecked
+    def number_to_currency(self, num: Number | Word, andword: str = "and") -> str:
+        """
+        Return an amount as on a check: dollars in words, cents as a fraction.
+
+        e.g. 100020.56 -> "one hundred thousand and twenty and 56/100"
+
+        The amount is rounded half up to the cent, going by the number as
+        written. andword is as for number_to_words; the "and" before the
+        cents is always written.
+
+        Raise BadNumValueError if num is not a finite number.
+        """
+        try:
+            amount = Decimal(str(num).strip())
+        except ArithmeticError as err:
+            raise BadNumValueError from err
+        if not amount.is_finite():
+            raise BadNumValueError
+
+        with decimal_module.localcontext() as ctx:
+            ctx.prec = max(ctx.prec, len(amount.as_tuple().digits) + 10)
+            cents = abs(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
+        dollars, fraction = divmod(int(cents * 100), 100)
+
+        words = self.number_to_words(str(dollars), andword=andword)
+        if amount < 0 and cents:
+            words = f"minus {words}"
+        return f"{words} and {fraction:02d}/100"
+
     @staticmethod
     def _render(chunks, decimal, comma):
         first_item = chunks.pop(0)
diff --git a/newsfragments/+number-to-currency.feature.rst b/newsfragments/+number-to-currency.feature.rst
new file mode 100644
index 0000000..6a6a173
--- /dev/null
+++ b/newsfragments/+number-to-currency.feature.rst
@@ -0,0 +1 @@
+Added ``number_to_currency``, which writes an amount as on a check, e.g. "one hundred thousand and twenty and 56/100".
diff --git a/tests/test_numwords.py b/tests/test_numwords.py
index 178a755..e856259 100644
--- a/tests/test_numwords.py
+++ b/tests/test_numwords.py
@@ -1,3 +1,5 @@
+import decimal
+
 import pytest
 
 import inflect
@@ -472,3 +474,29 @@ def test_issue_217():
         p.number_to_words("1234567", group=3)
         == "one, two thirty-four, five sixty-seven"
     )
+
+
+class TestNumberToCurrency:
+    @pytest.mark.parametrize(
+        "num, expected",
+        [
+            (100_020.56, "one hundred thousand and twenty and 56/100"),
+            (1234, "one thousand, two hundred and thirty-four and 00/100"),
+            (0.07, "zero and 07/100"),
+            ("19.99", "nineteen and 99/100"),
+            (2.675, "two and 68/100"),
+            (2.674, "two and 67/100"),
+            (decimal.Decimal("0.995"), "one and 00/100"),
+        ],
+    )
+    def test_amounts(self, num, expected):
+        assert inflect.engine().number_to_currency(num) == expected
+
+    def test_andword(self):
+        p = inflect.engine()
+        assert p.number_to_currency(101.01, andword="") == "one hundred one and 01/100"
+
+    @pytest.mark.parametrize("num", ["ten", "nan", "inf", float("nan")])
+    def test_bad(self, num):
+        with pytest.raises(inflect.BadNumValueError):
+            inflect.engine().number_to_currency(num)
```

</details>

<details><summary>reply</summary>

Need path; also add tests.

Done. I added `number_to_currency` in `inflect/__init__.py`, tests in `tests/test_numwords.py`, and a newsfragment. The full suite passes.

- **Empty string:** `""` raises a typeguard error rather than `BadNumValueError`, because the `Word` type rejects it, as in `number_to_words`.
- **Negatives:** I added this one myself. Negative amounts get a "minus" prefix, so `-5.5` gives `minus five and 50/100`. An amount that rounds to zero has no sign.
- **Not committed:** nothing is committed.

</details>

### claude, sloth: pass

Files: [inflect/__init__.py](../sloth/claude/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [newsfragments/+number-to-currency.feature.rst](../sloth/claude/python-feat-inflect-number-to-currency-1/files/newsfragments/+number-to-currency.feature.rst)

<details><summary>diff</summary>

```diff
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..e8d8c36 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -61,7 +61,7 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
-from decimal import Decimal
+from decimal import ROUND_HALF_UP, Context, Decimal, InvalidOperation
 from numbers import Number
 from re import Match
 from typing import (
@@ -3930,6 +3930,34 @@ class engine:
     def _get_sign(num):
         return {'+': 'plus', '-': 'minus'}.get(num.lstrip()[0], '')
 
+    @typechecked
+    def number_to_currency(self, num: Number | str, andword: str = "and") -> str:
+        """
+        Return an amount in words with the cents as a fraction of 100.
+
+        e.g. 100020.56 -> "one hundred thousand and twenty and 56/100"
+
+        The amount is rounded half up to the cent, going by the number as
+        written. The "and" before the cents is always written; andword only
+        affects the whole amount, as in number_to_words.
+
+        Raise BadNumValueError if num is not a finite number.
+        """
+        try:
+            amount = Decimal(str(num))
+            if not amount.is_finite():
+                raise BadNumValueError
+            amount = amount.quantize(
+                Decimal("0.01"),
+                rounding=ROUND_HALF_UP,
+                context=Context(prec=max(28, amount.adjusted() + 4)),
+            )
+        except InvalidOperation as err:
+            raise BadNumValueError from err
+        whole, cents = f"{amount:f}".split(".")
+        words = self.number_to_words(whole, andword=andword)
+        return f"{words} and {cents}/100"
+
     @typechecked
     def number_to_words(  # noqa: C901
         self,
diff --git a/newsfragments/+number-to-currency.feature.rst b/newsfragments/+number-to-currency.feature.rst
new file mode 100644
index 0000000..fe29a89
--- /dev/null
+++ b/newsfragments/+number-to-currency.feature.rst
@@ -0,0 +1 @@
+Added ``number_to_currency``, which writes an amount in words with the cents as a fraction of 100 (e.g. ``one hundred thousand and twenty and 56/100``).
```

</details>

<details><summary>reply</summary>

I added `number_to_currency(num, andword="and")` to the engine in `inflect/__init__.py`. All your examples produce the outputs you listed. The existing tests pass (278 passed, 16 xfailed). I didn't write new tests, and `ruff` isn't installed here, so lint and format weren't checked.

- **Rounding:** it rounds half up to the cent from the number as written, so `2.675` gives `68/100`, `2.674` gives `67/100` and `Decimal("0.995")` gives `one and 00/100`.
- **Bad input:** `"ten"`, `"nan"`, `"inf"`, `float("inf")`, `Decimal("NaN")`, `""` and `" "` all raise `BadNumValueError`. I typed the argument as `Number | str` rather than `Word`, so an empty string raises `BadNumValueError`. With `Word` it would have raised a `TypeCheckError`.
- **Negatives:** you didn't specify these. They get a "minus" prefix, so `-0.07` gives `minus zero and 07/100`.
- **Changelog:** I added a news fragment at `newsfragments/+number-to-currency.feature.rst`.

I haven't committed anything.

</details>

### claude, all: pass

Files: [inflect/__init__.py](../all/claude/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [newsfragments/+number-to-currency.feature.rst](../all/claude/python-feat-inflect-number-to-currency-1/files/newsfragments/+number-to-currency.feature.rst)

<details><summary>diff</summary>

```diff
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..1f07610 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -14,7 +14,7 @@ methods:
     compare compare_nouns compare_verbs compare_adjs
     present_participle
     ordinal
-    number_to_words
+    number_to_words number_to_currency
     join
     defnoun defverb defadj defa defan
 
@@ -36,7 +36,7 @@ ARTICLES:
     classical inflect num a an
 
 NUMERICAL:
-    ordinal number_to_words
+    ordinal number_to_words number_to_currency
 
 USER_DEFINED:
     defnoun defverb defadj defa defan
@@ -61,7 +61,7 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
-from decimal import Decimal
+from decimal import ROUND_HALF_UP, Decimal, InvalidOperation, localcontext
 from numbers import Number
 from re import Match
 from typing import (
@@ -4050,6 +4050,31 @@ class engine:
         )
         return signout + valout
 
+    @typechecked
+    def number_to_currency(self, num: Number | str, andword: str = "and") -> str:
+        """
+        Return an amount in words with the cents as a fraction of 100.
+
+        The amount is rounded half up to the cent, going by the number as written.
+        Raise BadNumValueError if num is not a finite number.
+
+        >>> engine().number_to_currency(100_020.56)
+        'one hundred thousand and twenty and 56/100'
+        """
+        try:
+            amount = Decimal(str(num).strip())
+        except InvalidOperation as err:
+            raise BadNumValueError from err
+        if not amount.is_finite():
+            raise BadNumValueError
+        with localcontext() as ctx:
+            ctx.prec = len(amount.as_tuple().digits) + max(amount.adjusted(), 0) + 4
+            total_cents = int((amount * 100).to_integral_value(ROUND_HALF_UP))
+        whole, cents = divmod(abs(total_cents), 100)
+        words = self.number_to_words(whole, andword=andword)
+        sign = "minus " * (total_cents < 0)
+        return f"{sign}{words} and {cents:02d}/100"
+
     @staticmethod
     def _render(chunks, decimal, comma):
         first_item = chunks.pop(0)
diff --git a/newsfragments/+number-to-currency.feature.rst b/newsfragments/+number-to-currency.feature.rst
new file mode 100644
index 0000000..6b694ab
--- /dev/null
+++ b/newsfragments/+number-to-currency.feature.rst
@@ -0,0 +1 @@
+New ``engine.number_to_currency`` writes an amount in words with the cents as a fraction of 100, as on a check (``one hundred thousand and twenty and 56/100``).
```

</details>

<details><summary>reply</summary>

Done. `number_to_currency` added in `inflect/__init__.py`, plus `newsfragments/+number-to-currency.feature.rst`. All your examples match, bad input raises `BadNumValueError`, and existing tests pass. I added no new tests.

Negative amounts come out as "minus five and 50/100".

</details>

### codex, base: pass

Files: [README.rst](../base/codex/python-feat-inflect-number-to-currency-1/files/README.rst), [inflect/__init__.py](../base/codex/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [tests/test_currency.py](../base/codex/python-feat-inflect-number-to-currency-1/files/tests/test_currency.py)

<details><summary>diff</summary>

```diff
diff --git a/README.rst b/README.rst
index 2799b7f..0372a51 100644
--- a/README.rst
+++ b/README.rst
@@ -200,6 +200,22 @@ Note: This returns a single string.
     >>> p.number_to_words(p.ordinal(1234))
     'one thousand, two hundred and thirty-fourth'
 
+Write Currency Amounts for Checks
+^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+``number_to_currency`` accepts integers, floats, Decimals, and numeric strings.
+It rounds half up to the nearest cent and raises ``BadNumValueError`` for
+invalid or non-finite amounts. ``andword`` controls the conjunction within
+the whole amount; the cents are always preceded by "and".
+
+.. code-block:: python
+
+    >>> p.number_to_currency(1234)
+    'one thousand, two hundred and thirty-four and 00/100'
+    >>> p.number_to_currency("2.675")
+    'two and 68/100'
+    >>> p.number_to_currency(101.01, andword="")
+    'one hundred one and 01/100'
+
 Retrieve Words as List of Parts
 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..915a6f2 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -61,7 +61,7 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
-from decimal import Decimal
+from decimal import ROUND_HALF_UP, Decimal, InvalidOperation, localcontext
 from numbers import Number
 from re import Match
 from typing import (
@@ -3930,6 +3930,37 @@ class engine:
     def _get_sign(num):
         return {'+': 'plus', '-': 'minus'}.get(num.lstrip()[0], '')
 
+    def number_to_currency(
+        self, num: int | float | Decimal | str, andword: str = "and"
+    ) -> str:
+        """
+        Return an amount in words with cents as a fraction of one hundred.
+
+        Round the written value half up to the nearest cent. ``andword``
+        controls the conjunction within the whole amount; the conjunction
+        before the cents is always 'and'.
+
+        >>> p = engine()
+        >>> p.number_to_currency(100_020.56)
+        'one hundred thousand and twenty and 56/100'
+        >>> p.number_to_currency(101.01, andword="")
+        'one hundred one and 01/100'
+        """
+        try:
+            amount = Decimal(str(num))
+            if not amount.is_finite():
+                raise BadNumValueError
+            with localcontext() as ctx:
+                # Allow the whole amount, two cents digits, and a carry.
+                ctx.prec = max(ctx.prec, amount.adjusted() + 4)
+                rounded = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
+        except (InvalidOperation, ValueError) as err:
+            raise BadNumValueError from err
+
+        whole, cents = format(rounded, "f").split(".")
+        words = self.number_to_words(whole, andword=andword)
+        return f"{words} and {cents}/100"
+
     @typechecked
     def number_to_words(  # noqa: C901
         self,
diff --git a/tests/test_currency.py b/tests/test_currency.py
new file mode 100644
index 0000000..47ae97d
--- /dev/null
+++ b/tests/test_currency.py
@@ -0,0 +1,57 @@
+from decimal import Decimal, localcontext
+
+import pytest
+
+import inflect
+
+
+@pytest.mark.parametrize(
+    'amount, expected',
+    [
+        (100_020.56, 'one hundred thousand and twenty and 56/100'),
+        (1234, 'one thousand, two hundred and thirty-four and 00/100'),
+        (0.07, 'zero and 07/100'),
+        ('19.99', 'nineteen and 99/100'),
+        (2.675, 'two and 68/100'),
+        (2.674, 'two and 67/100'),
+        (Decimal('0.995'), 'one and 00/100'),
+        ('999.995', 'one thousand and 00/100'),
+        (0, 'zero and 00/100'),
+        ('1e-3', 'zero and 00/100'),
+        ('1.999e2', 'one hundred and ninety-nine and 90/100'),
+        (-2.675, 'minus two and 68/100'),
+        ('-0.07', 'minus zero and 07/100'),
+        (10**30, 'one nonillion and 00/100'),
+    ],
+)
+def test_currency(amount, expected):
+    assert inflect.engine().number_to_currency(amount) == expected
+
+
+@pytest.mark.parametrize(
+    'andword, whole',
+    [('', 'one hundred one'), ('plus', 'one hundred plus one')],
+)
+def test_currency_andword(andword, whole):
+    result = inflect.engine().number_to_currency(101.01, andword=andword)
+    assert result == f'{whole} and 01/100'
+
+
+@pytest.mark.parametrize(
+    'amount',
+    [
+        'ten', '', 'nan', 'inf', '-Infinity',
+        float('nan'), float('inf'), Decimal('sNaN'), None, object(),
+    ],
+)
+def test_currency_invalid(amount):
+    with pytest.raises(inflect.BadNumValueError):
+        inflect.engine().number_to_currency(amount)
+
+
+def test_currency_decimal_context():
+    with localcontext() as ctx:
+        ctx.prec = 2
+        assert inflect.engine().number_to_currency('1234.565') == (
+            'one thousand, two hundred and thirty-four and 57/100'
+        )
```

</details>

<details><summary>reply</summary>

I’ll check how `number_to_words` works, add `number_to_currency`, and test the formatting, rounding, and invalid inputs.

The method passes the requested examples and rounding cases, including the carry from `0.995` to `one and 00/100`. I’ve added documentation and tests for negative amounts, scientific notation, and low Decimal precision. I’ll run the full suite next.

Added `engine.number_to_currency(num, andword="and")` with half-up rounding, two-digit cents, and `BadNumValueError` for invalid or non-finite values.

Added documentation and regression tests. Full suite: **306 passed, 16 xfailed**. Ruff wasn’t installed, so lint checks couldn’t run.

</details>

### codex, muffle: pass

Files: [README.rst](../muffle/codex/python-feat-inflect-number-to-currency-1/files/README.rst), [inflect/__init__.py](../muffle/codex/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [tests/test_currency.py](../muffle/codex/python-feat-inflect-number-to-currency-1/files/tests/test_currency.py)

<details><summary>diff</summary>

```diff
diff --git a/README.rst b/README.rst
index 2799b7f..04d2159 100644
--- a/README.rst
+++ b/README.rst
@@ -200,6 +200,21 @@ Note: This returns a single string.
     >>> p.number_to_words(p.ordinal(1234))
     'one thousand, two hundred and thirty-fourth'
 
+Write Check Amounts
+^^^^^^^^^^^^^^^^^^
+``number_to_currency`` rounds half up to the nearest cent and writes cents
+as a two-digit fraction. It accepts integers, floats, Decimals, and numeric
+strings. Invalid or non-finite amounts raise ``BadNumValueError``.
+``andword`` controls the whole amount; the separator before cents is always
+``and``.
+
+.. code-block:: python
+
+    >>> p.number_to_currency(1234)
+    'one thousand, two hundred and thirty-four and 00/100'
+    >>> p.number_to_currency(2.675)
+    'two and 68/100'
+
 Retrieve Words as List of Parts
 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..2ce6f98 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -61,7 +61,7 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
-from decimal import Decimal
+from decimal import ROUND_HALF_UP, Decimal, InvalidOperation, localcontext
 from numbers import Number
 from re import Match
 from typing import (
@@ -4050,6 +4050,36 @@ class engine:
         )
         return signout + valout
 
+    def number_to_currency(
+        self, num: int | float | Decimal | str, andword: str = "and"
+    ) -> str:
+        """
+        Return an amount in words with cents as a fraction of one hundred.
+
+        Round the number as written to the nearest cent, rounding ties away
+        from zero. ``andword`` applies to the whole amount; the separator
+        before the cents is always "and".
+
+        >>> p = engine()
+        >>> p.number_to_currency(100_020.56)
+        'one hundred thousand and twenty and 56/100'
+        >>> p.number_to_currency(101.01, andword="")
+        'one hundred one and 01/100'
+        """
+        try:
+            amount = Decimal(str(num))
+            if not amount.is_finite():
+                raise BadNumValueError
+            with localcontext() as ctx:
+                ctx.prec = max(28, amount.adjusted() + 4)
+                rounded = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
+        except (InvalidOperation, ValueError, TypeError) as err:
+            raise BadNumValueError from err
+
+        whole, cents = format(rounded, "f").split(".")
+        words = self.number_to_words(whole, andword=andword)
+        return f"{words} and {cents}/100"
+
     @staticmethod
     def _render(chunks, decimal, comma):
         first_item = chunks.pop(0)
diff --git a/tests/test_currency.py b/tests/test_currency.py
new file mode 100644
index 0000000..edeef4b
--- /dev/null
+++ b/tests/test_currency.py
@@ -0,0 +1,67 @@
+from decimal import Decimal, localcontext
+
+import pytest
+
+import inflect
+
+
+@pytest.mark.parametrize(
+    'amount, expected',
+    [
+        (100_020.56, 'one hundred thousand and twenty and 56/100'),
+        (1234, 'one thousand, two hundred and thirty-four and 00/100'),
+        (0.07, 'zero and 07/100'),
+        ('19.99', 'nineteen and 99/100'),
+        (2.675, 'two and 68/100'),
+        (2.674, 'two and 67/100'),
+        (Decimal('0.995'), 'one and 00/100'),
+        ('9.999', 'ten and 00/100'),
+        (0, 'zero and 00/100'),
+        (-12.345, 'minus twelve and 35/100'),
+        ('-0.07', 'minus zero and 07/100'),
+        ('1.999e1', 'nineteen and 99/100'),
+        (1e-7, 'zero and 00/100'),
+    ],
+)
+def test_currency(amount, expected):
+    assert inflect.engine().number_to_currency(amount) == expected
+
+
+@pytest.mark.parametrize('andword', ['', 'plus'])
+def test_currency_andword(andword):
+    p = inflect.engine()
+    whole = p.number_to_words(101, andword=andword)
+    assert p.number_to_currency(101.01, andword=andword) == f'{whole} and 01/100'
+
+
+@pytest.mark.parametrize(
+    'amount',
+    [
+        'ten',
+        '',
+        '1.2.3',
+        'nan',
+        'inf',
+        '-Infinity',
+        float('nan'),
+        float('inf'),
+        Decimal('NaN'),
+        Decimal('sNaN'),
+        Decimal('Infinity'),
+        None,
+    ],
+)
+def test_currency_invalid(amount):
+    with pytest.raises(inflect.BadNumValueError):
+        inflect.engine().number_to_currency(amount)
+
+
+def test_currency_decimal_precision():
+    p = inflect.engine()
+    with localcontext() as ctx:
+        ctx.prec = 3
+        assert p.number_to_currency('1234.995') == (
+            'one thousand, two hundred and thirty-five and 00/100'
+        )
+        amount = 10**30
+        assert p.number_to_currency(amount) == p.number_to_words(amount) + ' and 00/100'
```

</details>

<details><summary>reply</summary>

I’ll check how `number_to_words` works, add `number_to_currency` with decimal rounding, and run the relevant tests.

I’ll reuse `number_to_words` for the whole amount and convert the input’s string representation to `Decimal` for rounding. That gives `2.675` the requested half-up behavior and lets me reject invalid or non-finite values before formatting.

Added `engine.number_to_currency` with half-up decimal rounding, two-digit cents, `andword` support, and `BadNumValueError` for invalid or non-finite inputs.

Added documentation and tests. Full suite: **307 passed, 16 xfailed**. Ruff was unavailable.

</details>

### codex, hush: pass

Files: [inflect/__init__.py](../hush/codex/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [tests/test_currency.py](../hush/codex/python-feat-inflect-number-to-currency-1/files/tests/test_currency.py)

<details><summary>diff</summary>

```diff
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..2335ffb 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -61,7 +61,7 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
-from decimal import Decimal
+from decimal import ROUND_HALF_UP, Decimal, InvalidOperation, localcontext
 from numbers import Number
 from re import Match
 from typing import (
@@ -3930,6 +3930,31 @@ class engine:
     def _get_sign(num):
         return {'+': 'plus', '-': 'minus'}.get(num.lstrip()[0], '')
 
+    def number_to_currency(
+        self, num: int | float | Decimal | str, andword: str = "and"
+    ) -> str:
+        """Return an amount in words with cents as a fraction of one hundred.
+
+        Round the decimal representation half up to the nearest cent.
+        ``andword`` controls conjunctions in the whole amount; the cents
+        always follow the word "and".
+        """
+        try:
+            amount = Decimal(str(num))
+            if not amount.is_finite():
+                raise BadNumValueError
+            with localcontext() as context:
+                context.prec = max(28, amount.adjusted() + 4)
+                rounded = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
+        except (InvalidOperation, ValueError, TypeError) as error:
+            raise BadNumValueError from error
+
+        whole, cents = format(rounded.copy_abs(), "f").split(".")
+        if rounded < 0:
+            whole = "-" + whole
+        words = self.number_to_words(whole, andword=andword)
+        return f"{words} and {cents}/100"
+
     @typechecked
     def number_to_words(  # noqa: C901
         self,
diff --git a/tests/test_currency.py b/tests/test_currency.py
new file mode 100644
index 0000000..06020e8
--- /dev/null
+++ b/tests/test_currency.py
@@ -0,0 +1,50 @@
+from decimal import Decimal, localcontext
+
+import pytest
+
+import inflect
+
+
+@pytest.mark.parametrize(
+    ('amount', 'expected'),
+    [
+        (100_020.56, 'one hundred thousand and twenty and 56/100'),
+        (1234, 'one thousand, two hundred and thirty-four and 00/100'),
+        (0.07, 'zero and 07/100'),
+        ('19.99', 'nineteen and 99/100'),
+        (2.675, 'two and 68/100'),
+        (2.674, 'two and 67/100'),
+        (Decimal('0.995'), 'one and 00/100'),
+        ('1e3', 'one thousand and 00/100'),
+        (-0.07, 'minus zero and 07/100'),
+        ('-2.675', 'minus two and 68/100'),
+        (0, 'zero and 00/100'),
+    ],
+)
+def test_currency(amount, expected):
+    assert inflect.engine().number_to_currency(amount) == expected
+
+
+@pytest.mark.parametrize('andword', ['', 'plus'])
+def test_currency_andword(andword):
+    engine = inflect.engine()
+    whole = engine.number_to_words(101, andword=andword)
+    assert engine.number_to_currency(101.01, andword=andword) == f'{whole} and 01/100'
+
+
+@pytest.mark.parametrize(
+    'amount',
+    ['ten', '', 'nan', 'inf', '-Infinity', float('nan'), float('inf'),
+     Decimal('NaN'), Decimal('sNaN'), Decimal('Infinity'), None, complex(1, 2)],
+)
+def test_currency_invalid(amount):
+    with pytest.raises(inflect.BadNumValueError):
+        inflect.engine().number_to_currency(amount)
+
+
+def test_currency_decimal_context():
+    with localcontext() as context:
+        context.prec = 2
+        assert inflect.engine().number_to_currency('1234.995') == (
+            'one thousand, two hundred and thirty-five and 00/100'
+        )
```

</details>

<details><summary>reply</summary>

Currency conversion needs decimal half-up rounding; checking engine code and tests.


Done.
Added `number_to_currency` with half-up rounding, two-digit cents, custom `andword`, invalid-number errors. Tests: 304 passed, 16 xfailed. Ruff unavailable.

</details>

### codex, sloth: pass

Files: [inflect/__init__.py](../sloth/codex/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [newsfragments/+number-to-currency.feature.rst](../sloth/codex/python-feat-inflect-number-to-currency-1/files/newsfragments/+number-to-currency.feature.rst)

<details><summary>diff</summary>

```diff
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..1ca685d 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -14,7 +14,7 @@ methods:
     compare compare_nouns compare_verbs compare_adjs
     present_participle
     ordinal
-    number_to_words
+    number_to_words number_to_currency
     join
     defnoun defverb defadj defa defan
 
@@ -36,7 +36,7 @@ ARTICLES:
     classical inflect num a an
 
 NUMERICAL:
-    ordinal number_to_words
+    ordinal number_to_words number_to_currency
 
 USER_DEFINED:
     defnoun defverb defadj defa defan
@@ -61,7 +61,7 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
-from decimal import Decimal
+from decimal import ROUND_HALF_UP, Decimal, InvalidOperation, localcontext
 from numbers import Number
 from re import Match
 from typing import (
@@ -4050,6 +4050,28 @@ class engine:
         )
         return signout + valout
 
+    def number_to_currency(
+        self, num: int | float | Decimal | str, andword: str = "and"
+    ) -> str:
+        """
+        Return an amount in words with cents as a two-digit fraction of 100.
+
+        Round the number as written half up to the nearest cent. The andword
+        applies to the whole amount; the cents are always introduced by 'and'.
+        Raise BadNumValueError for invalid or non-finite numbers.
+        """
+        try:
+            amount = Decimal(str(num))
+            if not amount.is_finite():
+                raise BadNumValueError
+            with localcontext() as context:
+                context.prec = max(28, amount.adjusted() + 4)
+                rounded = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
+        except (InvalidOperation, ValueError) as err:
+            raise BadNumValueError from err
+        whole, cents = format(rounded, "f").split(".")
+        return f"{self.number_to_words(whole, andword=andword)} and {cents}/100"
+
     @staticmethod
     def _render(chunks, decimal, comma):
         first_item = chunks.pop(0)
diff --git a/newsfragments/+number-to-currency.feature.rst b/newsfragments/+number-to-currency.feature.rst
new file mode 100644
index 0000000..7ecf91b
--- /dev/null
+++ b/newsfragments/+number-to-currency.feature.rst
@@ -0,0 +1 @@
+Added ``engine.number_to_currency`` to render check amounts with half-up rounding and cents as a fraction of 100.
```

</details>

<details><summary>reply</summary>

I’ll check how `number_to_words` handles formatting and errors, then add the currency method using the existing conventions.

The change belongs in the engine class, its method listing, and a changelog entry. There are no separate exports or existing callers to update; the template function allowlist is outside the requested scope. I’ll reuse `number_to_words` for the whole amount and `Decimal` for rounding, without adding dependencies or options. Per the repository instructions, I’ll run existing tests without adding new ones.

Added `engine.number_to_currency` with half-up rounding, two-digit cents, and `BadNumValueError` for invalid or non-finite input.

Verified all supplied examples. Existing tests: **278 passed, 16 xfailed**.

Package build was blocked because the environment lacks both `build` and `pip`.

</details>

### codex, all: pass

Files: [inflect/__init__.py](../all/codex/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py)

<details><summary>diff</summary>

```diff
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..75ebad4 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -14,7 +14,7 @@ methods:
     compare compare_nouns compare_verbs compare_adjs
     present_participle
     ordinal
-    number_to_words
+    number_to_words number_to_currency
     join
     defnoun defverb defadj defa defan
 
@@ -36,7 +36,7 @@ ARTICLES:
     classical inflect num a an
 
 NUMERICAL:
-    ordinal number_to_words
+    ordinal number_to_words number_to_currency
 
 USER_DEFINED:
     defnoun defverb defadj defa defan
@@ -61,7 +61,7 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
-from decimal import Decimal
+from decimal import ROUND_HALF_UP, Decimal, InvalidOperation, localcontext
 from numbers import Number
 from re import Match
 from typing import (
@@ -3930,6 +3930,26 @@ class engine:
     def _get_sign(num):
         return {'+': 'plus', '-': 'minus'}.get(num.lstrip()[0], '')
 
+    def number_to_currency(
+        self, num: int | float | Decimal | str, andword: str = "and"
+    ) -> str:
+        """Return words for the whole amount followed by 'and NN/100'.
+
+        Round the written value half up to cents. Use andword within the
+        whole amount only. Raise BadNumValueError for invalid or nonfinite input.
+        """
+        try:
+            amount = Decimal(str(num))
+        except (InvalidOperation, ValueError) as err:
+            raise BadNumValueError from err
+        if not amount.is_finite():
+            raise BadNumValueError
+        with localcontext() as ctx:
+            ctx.prec = max(3, len(amount.as_tuple().digits), amount.adjusted() + 3)
+            amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
+        whole, cents = format(amount, "f").split(".")
+        return f"{self.number_to_words(whole, andword=andword)} and {cents}/100"
+
     @typechecked
     def number_to_words(  # noqa: C901
         self,
```

</details>

<details><summary>reply</summary>

Currency method needs decimal rounding and existing word formatting. Checking engine and validation.


Done.
Added `number_to_currency`, half-up rounding, input validation. Currency checks passed; 278 tests passed, 16 xfailed. Build blocked: missing `build` module.

</details>
