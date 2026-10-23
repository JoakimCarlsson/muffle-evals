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
| claude | muffle | pass | +46/-2 | 33 | 5,608 | $0.149 |
| claude | hush | pass | +35/-1 | 34 | 3,457 | $0.112 |
| claude | sloth | pass | +31/-2 | 22 | 3,720 | $0.101 |
| claude | all | pass | +29/-1 | 25 | 3,808 | $0.122 |
| codex | base | pass | +48/-1 | 57 | 2,271 | - |
| codex | muffle | pass | +44/-3 | 69 | 2,710 | - |
| codex | hush | pass | +44/-1 | 45 | 1,732 | - |
| codex | sloth | pass | +42/-3 | 49 | 2,662 | - |
| codex | all | pass | +17/-1 | 42 | 1,766 | - |

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

Files: [README.rst](../muffle/claude/python-feat-inflect-number-to-currency-1/files/README.rst), [inflect/__init__.py](../muffle/claude/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [newsfragments/+number-to-currency.feature.rst](../muffle/claude/python-feat-inflect-number-to-currency-1/files/newsfragments/+number-to-currency.feature.rst), [tests/test_currency.py](../muffle/claude/python-feat-inflect-number-to-currency-1/files/tests/test_currency.py)

<details><summary>diff</summary>

```diff
diff --git a/README.rst b/README.rst
index 2799b7f..14a195f 100644
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
@@ -200,6 +200,18 @@ Note: This returns a single string.
     >>> p.number_to_words(p.ordinal(1234))
     'one thousand, two hundred and thirty-fourth'
 
+Amounts for Checks
+^^^^^^^^^^^^^^^^^^
+
+.. code-block:: python
+
+    >>> p.number_to_currency(100_020.56)
+    'one hundred thousand and twenty and 56/100'
+    >>> p.number_to_currency("19.99")
+    'nineteen and 99/100'
+    >>> p.number_to_currency(101.01, andword="")
+    'one hundred one and 01/100'
+
 Retrieve Words as List of Parts
 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..1ccc85c 100644
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
@@ -4050,6 +4050,37 @@ class engine:
         )
         return signout + valout
 
+    @typechecked
+    def number_to_currency(self, num: Number | str, andword: str = "and") -> str:
+        """
+        Return an amount in words, with the cents as a fraction of 100.
+
+        e.g. 100020.56 -> "one hundred thousand and twenty and 56/100"
+
+        The amount is rounded half up to the nearest cent, going by the
+        number as written. Raise BadNumValueError if num is not a finite number.
+
+        andword: as for number_to_words (the "and" before the cents is
+        always written).
+        """
+        try:
+            amount = Decimal(num if isinstance(num, Decimal) else str(num))
+        except InvalidOperation as err:
+            raise BadNumValueError from err
+        if not amount.is_finite():
+            raise BadNumValueError
+        try:
+            cents = amount.quantize(
+                Decimal("0.01"), rounding=ROUND_HALF_UP, context=Context(prec=1000)
+            )
+        except InvalidOperation as err:  # too large to write out
+            raise BadNumValueError from err
+        whole, frac = divmod(abs(cents) * 100, 100)
+        words = self.number_to_words(
+            int(whole) * (-1 if cents < 0 and whole else 1), andword=andword
+        )
+        return f"{words} and {int(frac):02d}/100"
+
     @staticmethod
     def _render(chunks, decimal, comma):
         first_item = chunks.pop(0)
diff --git a/newsfragments/+number-to-currency.feature.rst b/newsfragments/+number-to-currency.feature.rst
new file mode 100644
index 0000000..bbc3ebc
--- /dev/null
+++ b/newsfragments/+number-to-currency.feature.rst
@@ -0,0 +1 @@
+Added ``number_to_currency``, which writes an amount in words with the cents as a fraction of 100 (for example "nineteen and 99/100"), as printed on checks.
diff --git a/tests/test_currency.py b/tests/test_currency.py
new file mode 100644
index 0000000..d7f6696
--- /dev/null
+++ b/tests/test_currency.py
@@ -0,0 +1,33 @@
+from decimal import Decimal
+
+import pytest
+
+import inflect
+
+
+@pytest.mark.parametrize(
+    "num, expected",
+    [
+        (100_020.56, 'one hundred thousand and twenty and 56/100'),
+        (1234, 'one thousand, two hundred and thirty-four and 00/100'),
+        (0.07, 'zero and 07/100'),
+        ("19.99", 'nineteen and 99/100'),
+        (2.675, 'two and 68/100'),
+        (2.674, 'two and 67/100'),
+        (Decimal("0.995"), 'one and 00/100'),
+        (-1.5, 'minus one and 50/100'),
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
+@pytest.mark.parametrize("num", ["ten", "nan", "inf", "", float("inf"), "1e999999999"])
+def test_number_to_currency_bad(num):
+    with pytest.raises(inflect.BadNumValueError):
+        inflect.engine().number_to_currency(num)
```

</details>

<details><summary>reply</summary>

Checking an empty string, which the `Word` type rejects. I'll loosen the annotation so it raises `BadNumValueError`.

I added `p.number_to_currency(num, andword="and")` in `inflect/__init__.py`. All your examples give the outputs you listed, and the full suite passes with the new tests.

- **Rounding:** it goes by the number as written, so `2.675` gives `68/100` and `2.674` gives `67/100`. `Decimal("0.995")` gives `'one and 00/100'`.
- **Bad input:** `"ten"`, `"nan"`, `"inf"`, `float("inf")` and `""` raise `inflect.BadNumValueError`. So does an absurdly large value like `"1e999999999"`.
- **Negative amounts:** you didn't specify these. `-1.5` gives `'minus one and 50/100'`. A negative that rounds to zero, like `-0.001`, gives `'zero and 00/100'` rather than "minus zero".

I also added tests in `tests/test_currency.py`, a README section and method-list entry, and a newsfragment at `newsfragments/+number-to-currency.feature.rst`.

I couldn't run `ruff` because it isn't installed here, so the formatting is unchecked. I haven't committed anything.

</details>

### claude, hush: pass

Files: [README.rst](../hush/claude/python-feat-inflect-number-to-currency-1/files/README.rst), [inflect/__init__.py](../hush/claude/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [newsfragments/+number-to-currency.feature.rst](../hush/claude/python-feat-inflect-number-to-currency-1/files/newsfragments/+number-to-currency.feature.rst), [tests/test_number_to_currency.py](../hush/claude/python-feat-inflect-number-to-currency-1/files/tests/test_number_to_currency.py)

<details><summary>diff</summary>

```diff
diff --git a/README.rst b/README.rst
index 2799b7f..fa2ce47 100644
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
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..6c8e75e 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -61,6 +61,7 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
+import decimal as decimal_module
 from decimal import Decimal
 from numbers import Number
 from re import Match
@@ -4050,6 +4051,38 @@ class engine:
         )
         return signout + valout
 
+    def number_to_currency(self, num: Number | Word, andword: str = "and") -> str:
+        """
+        Return an amount in words with the cents as a fraction of 100.
+
+        e.g. 100020.56 -> "one hundred thousand and twenty and 56/100"
+
+        The amount is rounded half up to the cent, going by the number as
+        written. andword is used as in number_to_words; the "and" before the
+        cents is always written.
+
+        Raise BadNumValueError if num is not a finite number.
+        """
+        try:
+            amount = num if isinstance(num, Decimal) else Decimal(str(num).strip())
+            if not amount.is_finite():
+                raise BadNumValueError
+            with decimal_module.localcontext() as ctx:
+                ctx.prec = max(ctx.prec, len(amount.as_tuple().digits) + 10)
+                if amount.adjusted() > 0:
+                    ctx.prec = max(ctx.prec, amount.adjusted() + 10)
+                rounded = amount.scaleb(2).to_integral_value(
+                    decimal_module.ROUND_HALF_UP
+                )
+                cents = int(rounded)
+        except (decimal_module.InvalidOperation, ValueError) as err:
+            raise BadNumValueError from err
+
+        whole, fraction = divmod(abs(cents), 100)
+        sign = "-" if cents < 0 else ""
+        words = self.number_to_words(f"{sign}{whole}", andword=andword)
+        return f"{words} and {fraction:02d}/100"
+
     @staticmethod
     def _render(chunks, decimal, comma):
         first_item = chunks.pop(0)
diff --git a/newsfragments/+number-to-currency.feature.rst b/newsfragments/+number-to-currency.feature.rst
new file mode 100644
index 0000000..6e435c4
--- /dev/null
+++ b/newsfragments/+number-to-currency.feature.rst
@@ -0,0 +1 @@
+Added ``number_to_currency`` to write an amount in words with the cents as a fraction of 100, e.g. "one hundred thousand and twenty and 56/100".
diff --git a/tests/test_number_to_currency.py b/tests/test_number_to_currency.py
new file mode 100644
index 0000000..96f226e
--- /dev/null
+++ b/tests/test_number_to_currency.py
@@ -0,0 +1,34 @@
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
+        (-0.001, 'zero and 00/100'),
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
+@pytest.mark.parametrize('bad', ["ten", "nan", "inf", "", float("inf"), Decimal("NaN")])
+def test_number_to_currency_bad(bad):
+    with pytest.raises(inflect.BadNumValueError):
+        inflect.engine().number_to_currency(bad)
```

</details>

<details><summary>reply</summary>

Done. Added `number_to_currency` to `inflect/__init__.py`, plus tests, a newsfragment and a README line. Full suite passes; ruff and mypy not run.

</details>

### claude, sloth: pass

Files: [inflect/__init__.py](../sloth/claude/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [newsfragments/+number-to-currency.feature.rst](../sloth/claude/python-feat-inflect-number-to-currency-1/files/newsfragments/+number-to-currency.feature.rst), [tests/test_numwords.py](../sloth/claude/python-feat-inflect-number-to-currency-1/files/tests/test_numwords.py)

<details><summary>diff</summary>

```diff
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..e96150a 100644
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
+from decimal import ROUND_HALF_UP, Context, Decimal, InvalidOperation
 from numbers import Number
 from re import Match
 from typing import (
@@ -4050,6 +4050,34 @@ class engine:
         )
         return signout + valout
 
+    @typechecked
+    def number_to_currency(self, num: Number | str, andword: str = "and") -> str:
+        """
+        Return an amount in words with the cents as a fraction of 100.
+
+        e.g. 100020.56 gives "one hundred thousand and twenty and 56/100"
+
+        The amount is rounded half up to the cent, going by the number as written.
+        andword is passed to number_to_words; the "and" before the cents is fixed.
+
+        Raise BadNumValueError if num is not a finite number.
+        """
+        try:
+            amount = Decimal(str(num))
+        except InvalidOperation as err:
+            raise BadNumValueError from err
+        if not amount.is_finite():
+            raise BadNumValueError
+        rounded = amount.quantize(
+            Decimal("0.01"),
+            rounding=ROUND_HALF_UP,
+            context=Context(prec=max(28, amount.adjusted() + 4)),
+        )
+        sign = "-" if rounded < 0 else ""
+        whole, cents = f"{rounded.copy_abs():f}".split(".")
+        words = self.number_to_words(sign + whole, andword=andword)
+        return f"{words} and {cents}/100"
+
     @staticmethod
     def _render(chunks, decimal, comma):
         first_item = chunks.pop(0)
diff --git a/newsfragments/+number-to-currency.feature.rst b/newsfragments/+number-to-currency.feature.rst
new file mode 100644
index 0000000..76780b4
--- /dev/null
+++ b/newsfragments/+number-to-currency.feature.rst
@@ -0,0 +1 @@
+Added ``number_to_currency``, which writes an amount in words with the cents as a fraction of 100 (such as ``one hundred thousand and twenty and 56/100``).
diff --git a/tests/test_numwords.py b/tests/test_numwords.py
index 178a755..96b7c77 100644
--- a/tests/test_numwords.py
+++ b/tests/test_numwords.py
@@ -1,3 +1,5 @@
+from decimal import Decimal
+
 import pytest
 
 import inflect
@@ -472,3 +474,23 @@ def test_issue_217():
         p.number_to_words("1234567", group=3)
         == "one, two thirty-four, five sixty-seven"
     )
+
+
+def test_number_to_currency():
+    p = inflect.engine()
+    assert p.number_to_currency(100_020.56) == "one hundred thousand and twenty and 56/100"
+    assert (
+        p.number_to_currency(1234)
+        == "one thousand, two hundred and thirty-four and 00/100"
+    )
+    assert p.number_to_currency(0.07) == "zero and 07/100"
+    assert p.number_to_currency("19.99") == "nineteen and 99/100"
+    assert p.number_to_currency(101.01, andword="") == "one hundred one and 01/100"
+    assert p.number_to_currency(2.675) == "two and 68/100"
+    assert p.number_to_currency(2.674) == "two and 67/100"
+    assert p.number_to_currency(Decimal("0.995")) == "one and 00/100"
+    assert p.number_to_currency(-0.5) == "minus zero and 50/100"
+    assert p.number_to_currency(10**30) == p.number_to_words(10**30) + " and 00/100"
+    for bad in ("ten", "nan", "inf", "-inf", "", float("nan"), Decimal("Infinity")):
+        with pytest.raises(inflect.BadNumValueError):
+            p.number_to_currency(bad)
```

</details>

<details><summary>reply</summary>

Fixing an edge case: an empty string fails the `Word` type check, but it should raise `BadNumValueError`.

I added `p.number_to_currency(num, andword="and")` in `inflect/__init__.py`. The full test suite passes (269 passed, 16 xfailed). `ruff` isn't installed here, so I haven't run lint or the format check.

I checked all five of your examples, plus `2.675`, `2.674` and `Decimal("0.995")`. They give the strings you listed.

- **Rounding:** the amount is rounded half up to the cent, going by the number as written. `2.675` is read as exactly `2.675` (not the binary float), so it gives `68/100`.
- **Non-numbers:** `"ten"`, `"nan"`, `"inf"`, `"-inf"`, `""`, a float NaN and `Decimal("Infinity")` all raise `BadNumValueError`.
- **Negatives:** `-0.5` gives `'minus zero and 50/100'`. You didn't specify this case, so say if you want something different.
- **Large amounts:** `10**30` works.
- **Type check:** `num` is annotated `Number | str` rather than `Number | Word`, because `Word` rejects the empty string before it could raise `BadNumValueError`.

I also added a `test_number_to_currency` test in `tests/test_numwords.py`, a changelog entry in `newsfragments/+number-to-currency.feature.rst`, and `number_to_currency` to the module docstring's function list. Nothing is committed.

</details>

### claude, all: pass

Files: [inflect/__init__.py](../all/claude/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [newsfragments/+number-to-currency.feature.rst](../all/claude/python-feat-inflect-number-to-currency-1/files/newsfragments/+number-to-currency.feature.rst), [tests/test_numwords.py](../all/claude/python-feat-inflect-number-to-currency-1/files/tests/test_numwords.py)

<details><summary>diff</summary>

```diff
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..ff2b013 100644
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
@@ -4050,6 +4050,33 @@ class engine:
         )
         return signout + valout
 
+    @typechecked
+    def number_to_currency(self, num: Number | str, andword: str = "and") -> str:
+        """
+        Return an amount as check-style words with the cents as a fraction of 100.
+
+        The amount is rounded half up to the cent, going by the number as written.
+        andword: as for number_to_words; the "and" before the cents is always used.
+
+        >>> engine().number_to_currency(1234.5)
+        'one thousand, two hundred and thirty-four and 50/100'
+
+        Raise BadNumValueError for anything that is not a finite number.
+        """
+        try:
+            amount = num if isinstance(num, Decimal) else Decimal(str(num))
+            if not amount.is_finite():
+                raise BadNumValueError
+            context = Context(prec=max(28, amount.adjusted() + 4), rounding=ROUND_HALF_UP)
+            rounded = amount.quantize(Decimal("0.01"), context=context)
+        except InvalidOperation as err:
+            raise BadNumValueError from err
+        whole = int(rounded)
+        cents = abs(int(rounded.scaleb(2, context=context))) % 100
+        sign = "minus " if rounded < 0 and not whole else ""
+        words = self.number_to_words(whole, andword=andword)
+        return f"{sign}{words} and {cents:02d}/100"
+
     @staticmethod
     def _render(chunks, decimal, comma):
         first_item = chunks.pop(0)
diff --git a/newsfragments/+number-to-currency.feature.rst b/newsfragments/+number-to-currency.feature.rst
new file mode 100644
index 0000000..76780b4
--- /dev/null
+++ b/newsfragments/+number-to-currency.feature.rst
@@ -0,0 +1 @@
+Added ``number_to_currency``, which writes an amount in words with the cents as a fraction of 100 (such as ``one hundred thousand and twenty and 56/100``).
diff --git a/tests/test_numwords.py b/tests/test_numwords.py
index 178a755..f980366 100644
--- a/tests/test_numwords.py
+++ b/tests/test_numwords.py
@@ -1,3 +1,5 @@
+from decimal import Decimal
+
 import pytest
 
 import inflect
@@ -472,3 +474,26 @@ def test_issue_217():
         p.number_to_words("1234567", group=3)
         == "one, two thirty-four, five sixty-seven"
     )
+
+
+def test_number_to_currency():
+    p = inflect.engine()
+    assert p.number_to_currency(100_020.56) == 'one hundred thousand and twenty and 56/100'
+    assert (
+        p.number_to_currency(1234)
+        == 'one thousand, two hundred and thirty-four and 00/100'
+    )
+    assert p.number_to_currency(0.07) == 'zero and 07/100'
+    assert p.number_to_currency("19.99") == 'nineteen and 99/100'
+    assert p.number_to_currency(101.01, andword="") == 'one hundred one and 01/100'
+    assert p.number_to_currency(2.675) == 'two and 68/100'
+    assert p.number_to_currency(2.674) == 'two and 67/100'
+    assert p.number_to_currency(Decimal("0.995")) == 'one and 00/100'
+    assert p.number_to_currency(-0.5) == 'minus zero and 50/100'
+    assert p.number_to_currency(10**30) .endswith(' and 00/100')
+
+
+@pytest.mark.parametrize("bad", ["ten", "nan", "inf", "-inf", "", Decimal("NaN"), float("inf")])
+def test_number_to_currency_bad(bad):
+    with pytest.raises(inflect.BadNumValueError):
+        inflect.engine().number_to_currency(bad)
```

</details>

<details><summary>reply</summary>

Fixing the cents calculation for huge numbers: `%` hits the default 28-digit precision.

Done. I added `engine.number_to_currency` in `inflect/__init__.py`, with tests in `tests/test_numwords.py` and a newsfragment. The full suite passes (276 passed, 16 xfailed), and every example from your request is in the tests. `ruff` isn't installed here, so lint and format weren't run.

- **Negatives:** `-0.5` gives `'minus zero and 50/100'`. You didn't specify this, so I chose it.
- **Empty string:** `""` raises `BadNumValueError`. `number_to_words` can't take an empty string, so the empty case is only handled here.

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
index 2799b7f..bc2f610 100644
--- a/README.rst
+++ b/README.rst
@@ -200,6 +200,20 @@ Note: This returns a single string.
     >>> p.number_to_words(p.ordinal(1234))
     'one thousand, two hundred and thirty-fourth'
 
+Write Currency Amounts
+^^^^^^^^^^^^^^^^^^^^^
+``number_to_currency`` accepts integers, floats, ``Decimal`` values, and numeric
+strings. It rounds half up to the nearest cent and writes cents as a fraction.
+``andword`` controls conjunctions in the whole amount; the cents always use "and".
+Invalid and non-finite amounts raise ``inflect.BadNumValueError``.
+
+.. code-block:: python
+
+    >>> p.number_to_currency(100_020.56)
+    'one hundred thousand and twenty and 56/100'
+    >>> p.number_to_currency(101.01, andword="")
+    'one hundred one and 01/100'
+
 Retrieve Words as List of Parts
 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..4b641cf 100644
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
+from decimal import ROUND_HALF_UP, Context, Decimal, DecimalException
 from numbers import Number
 from re import Match
 from typing import (
@@ -4050,6 +4050,33 @@ class engine:
         )
         return signout + valout
 
+    def number_to_currency(
+        self, num: int | float | Decimal | str, andword: str = "and"
+    ) -> str:
+        """Return an amount in words with cents as a fraction of one hundred.
+
+        Round the written number half up to the nearest cent. ``andword``
+        controls conjunctions in the whole amount; cents always use "and".
+        Invalid or non-finite amounts raise :class:`BadNumValueError`.
+        """
+        try:
+            amount = Decimal(str(num))
+        except (DecimalException, ValueError, TypeError) as err:
+            raise BadNumValueError from err
+        if not amount.is_finite():
+            raise BadNumValueError
+
+        # Allow a carry and two decimal places, independent of the caller's
+        # decimal precision and rounding settings.
+        precision = max(len(amount.as_tuple().digits), amount.adjusted() + 1) + 3
+        rounded = amount.quantize(
+            Decimal("0.01"), context=Context(prec=precision, rounding=ROUND_HALF_UP)
+        )
+        whole, cents = format(rounded.copy_abs(), "f").split(".")
+        sign = "minus " if rounded.is_signed() else ""
+        words = self.number_to_words(whole, andword=andword)
+        return f"{sign}{words} and {cents}/100"
+
     @staticmethod
     def _render(chunks, decimal, comma):
         first_item = chunks.pop(0)
diff --git a/tests/test_currency.py b/tests/test_currency.py
new file mode 100644
index 0000000..772e472
--- /dev/null
+++ b/tests/test_currency.py
@@ -0,0 +1,69 @@
+from decimal import Decimal, Inexact, localcontext
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
+        ('9.999', 'ten and 00/100'),
+        (0, 'zero and 00/100'),
+        (-2.675, 'minus two and 68/100'),
+        ('-0.07', 'minus zero and 07/100'),
+        ('1.234e3', 'one thousand, two hundred and thirty-four and 00/100'),
+        (1e-7, 'zero and 00/100'),
+        ('1234567890123456789012345678.995', None),
+    ],
+)
+def test_currency(amount, expected):
+    p = inflect.engine()
+    if expected is None:
+        expected = p.number_to_words('1234567890123456789012345679') + ' and 00/100'
+    assert p.number_to_currency(amount) == expected
+
+
+@pytest.mark.parametrize('andword', ['', 'plus'])
+def test_currency_andword(andword):
+    p = inflect.engine()
+    expected = p.number_to_words(101, andword=andword) + ' and 01/100'
+    assert p.number_to_currency(101.01, andword=andword) == expected
+
+
+@pytest.mark.parametrize(
+    'amount',
+    [
+        'ten',
+        '',
+        '1.2.3',
+        'nan',
+        'sNaN',
+        'inf',
+        '-Infinity',
+        float('nan'),
+        float('inf'),
+        Decimal('NaN'),
+        Decimal('Infinity'),
+        None,
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
+        ctx.traps[Inexact] = True
+        assert inflect.engine().number_to_currency('1234.995') == (
+            'one thousand, two hundred and thirty-five and 00/100'
+        )
```

</details>

<details><summary>reply</summary>

I’ll check how `number_to_words` handles numbers, then add `number_to_currency` with focused tests for rounding and invalid inputs.

The method now rounds the input’s decimal text with half-up rounding, then uses `number_to_words` for the whole amount. It also preserves the sign for negative amounts below one dollar and uses its own decimal context so caller settings won’t change the result.

Added `engine.number_to_currency(num, andword="and")` with half-up rounding, two-digit cents, and `BadNumValueError` for invalid or non-finite inputs. Added documentation and regression tests.

Validation: 307 passed, 16 expected failures. Ruff wasn’t installed, so lint checks couldn’t run.

</details>

### codex, hush: pass

Files: [README.rst](../hush/codex/python-feat-inflect-number-to-currency-1/files/README.rst), [inflect/__init__.py](../hush/codex/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [tests/test_currency.py](../hush/codex/python-feat-inflect-number-to-currency-1/files/tests/test_currency.py)

<details><summary>diff</summary>

```diff
diff --git a/README.rst b/README.rst
index 2799b7f..7327c15 100644
--- a/README.rst
+++ b/README.rst
@@ -200,6 +200,21 @@ Note: This returns a single string.
     >>> p.number_to_words(p.ordinal(1234))
     'one thousand, two hundred and thirty-fourth'
 
+Write Check Amounts
+^^^^^^^^^^^^^^^^^^
+
+``number_to_currency`` accepts integers, floats, Decimals, and numeric strings.
+It rounds half up to cents and rejects invalid or non-finite numbers with
+``BadNumValueError``. The cents always follow ``and``, even when ``andword``
+changes the conjunction within the whole amount.
+
+.. code-block:: python
+
+    >>> p.number_to_currency(100_020.56)
+    'one hundred thousand and twenty and 56/100'
+    >>> p.number_to_currency(101.01, andword="")
+    'one hundred one and 01/100'
+
 Retrieve Words as List of Parts
 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..947360d 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -61,7 +61,7 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
-from decimal import Decimal
+from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, localcontext
 from numbers import Number
 from re import Match
 from typing import (
@@ -3930,6 +3930,34 @@ class engine:
     def _get_sign(num):
         return {'+': 'plus', '-': 'minus'}.get(num.lstrip()[0], '')
 
+    @typechecked
+    def number_to_currency(
+        self, num: int | float | Decimal | str, andword: str = "and"
+    ) -> str:
+        """Return an amount in words with cents as a fraction of one hundred.
+
+        Round half up using the decimal representation of the amount.
+        ``andword`` controls conjunctions within the whole amount only.
+
+        >>> engine().number_to_currency(100_020.56)
+        'one hundred thousand and twenty and 56/100'
+        >>> engine().number_to_currency(101.01, andword="")
+        'one hundred one and 01/100'
+        """
+        try:
+            amount = Decimal(str(num))
+            if not amount.is_finite():
+                raise BadNumValueError
+            with localcontext() as ctx:
+                ctx.prec = max(28, amount.adjusted() + 4)
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
index 0000000..8ab7b94
--- /dev/null
+++ b/tests/test_currency.py
@@ -0,0 +1,45 @@
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
+        ('1e-2', 'zero and 01/100'),
+        (-1.235, 'minus one and 24/100'),
+        ('-0.07', 'minus zero and 07/100'),
+        (0, 'zero and 00/100'),
+    ],
+)
+def test_number_to_currency(amount, expected):
+    assert inflect.engine().number_to_currency(amount) == expected
+
+
+@pytest.mark.parametrize('andword, whole', [('', 'one hundred one'), ('plus', 'one hundred plus one')])
+def test_currency_andword(andword, whole):
+    assert inflect.engine().number_to_currency(101.01, andword=andword) == f'{whole} and 01/100'
+
+
+@pytest.mark.parametrize('amount', ['ten', '', 'nan', 'inf', '-Infinity', float('nan'), float('inf'), Decimal('sNaN')])
+def test_currency_invalid(amount):
+    with pytest.raises(inflect.BadNumValueError):
+        inflect.engine().number_to_currency(amount)
+
+
+def test_currency_decimal_precision():
+    with localcontext() as ctx:
+        ctx.prec = 2
+        assert inflect.engine().number_to_currency(Decimal('1234.565')) == (
+            'one thousand, two hundred and thirty-four and 57/100'
+        )
```

</details>

<details><summary>reply</summary>

Done.
Added `number_to_currency`, half-up rounding, validation, docs, tests. 302 tests passed; 16 expected failures. Lint unavailable.

</details>

### codex, sloth: pass

Files: [README.rst](../sloth/codex/python-feat-inflect-number-to-currency-1/files/README.rst), [inflect/__init__.py](../sloth/codex/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [tests/test_numwords.py](../sloth/codex/python-feat-inflect-number-to-currency-1/files/tests/test_numwords.py)

<details><summary>diff</summary>

```diff
diff --git a/README.rst b/README.rst
index 2799b7f..b23b487 100644
--- a/README.rst
+++ b/README.rst
@@ -200,6 +200,21 @@ Note: This returns a single string.
     >>> p.number_to_words(p.ordinal(1234))
     'one thousand, two hundred and thirty-fourth'
 
+Write Check Amounts
+^^^^^^^^^^^^^^^^^^
+
+``number_to_currency`` accepts integers, floats, Decimals, and numeric strings.
+It rounds half up to the nearest cent and always joins the cents with "and".
+``andword`` controls the wording within the whole amount.
+Invalid or non-finite amounts raise ``BadNumValueError``.
+
+.. code-block:: python
+
+    >>> p.number_to_currency(100_020.56)
+    'one hundred thousand and twenty and 56/100'
+    >>> p.number_to_currency(101.01, andword="")
+    'one hundred one and 01/100'
+
 Retrieve Words as List of Parts
 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..4174bc9 100644
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
@@ -4050,6 +4050,30 @@ class engine:
         )
         return signout + valout
 
+    @typechecked
+    def number_to_currency(
+        self, num: float | Decimal | str, andword: str = "and"
+    ) -> str:
+        """Return an amount in words with cents as a two-digit fraction.
+
+        Round half up to the nearest cent using the number's written value.
+        ``andword`` controls the whole amount; cents always follow 'and'.
+        Raise BadNumValueError for invalid or non-finite numbers.
+        """
+        try:
+            amount = Decimal(str(num))
+            if not amount.is_finite():
+                raise BadNumValueError
+            with localcontext() as ctx:
+                ctx.prec = max(
+                    ctx.prec, len(amount.as_tuple().digits), amount.adjusted() + 3
+                )
+                rounded = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
+        except InvalidOperation as err:
+            raise BadNumValueError from err
+        whole, cents = format(rounded, ".2f").split(".")
+        return f"{self.number_to_words(whole, andword=andword)} and {cents}/100"
+
     @staticmethod
     def _render(chunks, decimal, comma):
         first_item = chunks.pop(0)
diff --git a/tests/test_numwords.py b/tests/test_numwords.py
index 178a755..aef8bb4 100644
--- a/tests/test_numwords.py
+++ b/tests/test_numwords.py
@@ -1,8 +1,57 @@
+from decimal import Decimal, localcontext
+
 import pytest
 
 import inflect
 
 
+@pytest.mark.parametrize(
+    'num, andword, expected',
+    [
+        (100_020.56, 'and', 'one hundred thousand and twenty and 56/100'),
+        (1234, 'and', 'one thousand, two hundred and thirty-four and 00/100'),
+        (0.07, 'and', 'zero and 07/100'),
+        ('19.99', 'and', 'nineteen and 99/100'),
+        (101.01, '', 'one hundred one and 01/100'),
+        (101.01, 'plus', 'one hundred plus one and 01/100'),
+        (2.675, 'and', 'two and 68/100'),
+        (2.674, 'and', 'two and 67/100'),
+        (Decimal('0.995'), 'and', 'one and 00/100'),
+        (0, 'and', 'zero and 00/100'),
+        (-2.675, 'and', 'minus two and 68/100'),
+        ('-0.07', 'and', 'minus zero and 07/100'),
+        ('1e3', 'and', 'one thousand and 00/100'),
+        ('1.0050000000000000000000000001', 'and', 'one and 01/100'),
+    ],
+)
+def test_number_to_currency(num, andword, expected):
+    """Render supported amounts and round independently of decimal precision."""
+    with localcontext() as ctx:
+        ctx.prec = 2
+        assert inflect.engine().number_to_currency(num, andword=andword) == expected
+
+
+@pytest.mark.parametrize(
+    'num',
+    [
+        '',
+        'ten',
+        'nan',
+        'inf',
+        '-Infinity',
+        float('nan'),
+        float('inf'),
+        Decimal('NaN'),
+        Decimal('sNaN'),
+        Decimal('Infinity'),
+    ],
+)
+def test_number_to_currency_invalid(num):
+    """Reject invalid and non-finite amounts with the public exception."""
+    with pytest.raises(inflect.BadNumValueError):
+        inflect.engine().number_to_currency(num)
+
+
 def test_loop():
     p = inflect.engine()
```

</details>

<details><summary>reply</summary>

I’ll check the existing conversion code and tests, then add the method using decimal half-up rounding and the current word formatting.

The change needs the engine method, its API documentation, and tests in the existing number-conversion test file. I’ll reuse `number_to_words` for the whole amount and leave its callers and formatting options unchanged.

All 302 tests passed, with 16 expected failures. The tests cover your examples, invalid values, rounding across a whole-number boundary, and reduced decimal precision. The environment lacks `build` and `ruff`; I’m checking whether `uv` can run those final checks.

Added `engine.number_to_currency(num, andword="and")` with half-up rounding, two-digit cents, and `BadNumValueError` for invalid or non-finite values. Included documentation and tests for your examples and edge cases.

Validation: 302 tests passed, 16 expected failures; lint, formatting, and package build passed.

</details>

### codex, all: pass

Files: [inflect/__init__.py](../all/codex/python-feat-inflect-number-to-currency-1/files/inflect/__init__.py), [tests/test_numwords.py](../all/codex/python-feat-inflect-number-to-currency-1/files/tests/test_numwords.py)

<details><summary>diff</summary>

```diff
diff --git a/inflect/__init__.py b/inflect/__init__.py
index cbe1702..9f51ee7 100644
--- a/inflect/__init__.py
+++ b/inflect/__init__.py
@@ -61,7 +61,7 @@ import functools
 import itertools
 import re
 from collections.abc import Callable, Iterable, Iterator, Sequence
-from decimal import Decimal
+from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, localcontext
 from numbers import Number
 from re import Match
 from typing import (
@@ -3930,6 +3930,22 @@ class engine:
     def _get_sign(num):
         return {'+': 'plus', '-': 'minus'}.get(num.lstrip()[0], '')
 
+    def number_to_currency(
+        self, num: int | float | Decimal | str, andword: str = "and"
+    ) -> str:
+        """Return an amount in words with cents rounded half up as a fraction."""
+        try:
+            amount = Decimal(str(num))
+            if not amount.is_finite():
+                raise BadNumValueError
+            with localcontext() as context:
+                context.prec = max(len(amount.as_tuple().digits), amount.adjusted() + 1) + 2
+                amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
+        except (InvalidOperation, ValueError) as error:
+            raise BadNumValueError from error
+        whole, cents = format(amount, "f").split(".")
+        return f"{self.number_to_words(whole, andword=andword)} and {cents}/100"
+
     @typechecked
     def number_to_words(  # noqa: C901
         self,
diff --git a/tests/test_numwords.py b/tests/test_numwords.py
index 178a755..be3acfa 100644
--- a/tests/test_numwords.py
+++ b/tests/test_numwords.py
@@ -1,8 +1,50 @@
+from decimal import Decimal
+
 import pytest
 
 import inflect
 
 
+@pytest.mark.parametrize(
+    'num, andword, expected',
+    [
+        (100_020.56, 'and', 'one hundred thousand and twenty and 56/100'),
+        (1234, 'and', 'one thousand, two hundred and thirty-four and 00/100'),
+        (0.07, 'and', 'zero and 07/100'),
+        ('19.99', 'and', 'nineteen and 99/100'),
+        (101.01, '', 'one hundred one and 01/100'),
+        (101.01, 'plus', 'one hundred plus one and 01/100'),
+        (2.675, 'and', 'two and 68/100'),
+        (2.674, 'and', 'two and 67/100'),
+        (Decimal('0.995'), 'and', 'one and 00/100'),
+        (0, 'and', 'zero and 00/100'),
+        (-2.675, 'and', 'minus two and 68/100'),
+        (-0.07, 'and', 'minus zero and 07/100'),
+        ('1e3', 'and', 'one thousand and 00/100'),
+        (1e-7, 'and', 'zero and 00/100'),
+        (Decimal('12345678901234567890123456789.995'), 'and',
+         'twelve octillion, three hundred and forty-five septillion, '
+         'six hundred and seventy-eight sextillion, nine hundred and one quintillion, '
+         'two hundred and thirty-four quadrillion, five hundred and sixty-seven trillion, '
+         'eight hundred and ninety billion, one hundred and twenty-three million, '
+         'four hundred and fifty-six thousand, seven hundred and ninety and 00/100'),
+    ],
+)
+def test_number_to_currency(num, andword, expected):
+    """Currency preserves whole-number wording and rounds cents from decimal text."""
+    assert inflect.engine().number_to_currency(num, andword=andword) == expected
+
+
+@pytest.mark.parametrize(
+    'num', ['ten', '', 'nan', 'inf', '-inf', float('nan'), float('inf'),
+            Decimal('NaN'), Decimal('sNaN'), Decimal('Infinity'), None, object()],
+)
+def test_number_to_currency_invalid(num):
+    """Invalid and nonfinite amounts raise the public number error."""
+    with pytest.raises(inflect.BadNumValueError):
+        inflect.engine().number_to_currency(num)
+
+
 def test_loop():
     p = inflect.engine()
```

</details>

<details><summary>reply</summary>

Currency method needs decimal rounding and focused tests.

Done. Added currency conversion, half-up rounding, validation. Tests: 305 passed. Build and lint tools unavailable.

</details>
