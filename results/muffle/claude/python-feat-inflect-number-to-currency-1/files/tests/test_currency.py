from decimal import Decimal

import pytest

import inflect


@pytest.mark.parametrize(
    "num, expected",
    [
        (100_020.56, 'one hundred thousand and twenty and 56/100'),
        (1234, 'one thousand, two hundred and thirty-four and 00/100'),
        (0.07, 'zero and 07/100'),
        ("19.99", 'nineteen and 99/100'),
        (2.675, 'two and 68/100'),
        (2.674, 'two and 67/100'),
        (Decimal("0.995"), 'one and 00/100'),
        (-1.5, 'minus one and 50/100'),
    ],
)
def test_number_to_currency(num, expected):
    assert inflect.engine().number_to_currency(num) == expected


def test_number_to_currency_andword():
    p = inflect.engine()
    assert p.number_to_currency(101.01, andword="") == 'one hundred one and 01/100'


@pytest.mark.parametrize("num", ["ten", "nan", "inf", "", float("inf"), "1e999999999"])
def test_number_to_currency_bad(num):
    with pytest.raises(inflect.BadNumValueError):
        inflect.engine().number_to_currency(num)
