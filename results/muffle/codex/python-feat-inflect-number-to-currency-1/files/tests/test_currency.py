from decimal import Decimal, localcontext

import pytest

import inflect


@pytest.mark.parametrize(
    'amount, expected',
    [
        (100_020.56, 'one hundred thousand and twenty and 56/100'),
        (1234, 'one thousand, two hundred and thirty-four and 00/100'),
        (0.07, 'zero and 07/100'),
        ('19.99', 'nineteen and 99/100'),
        (2.675, 'two and 68/100'),
        (2.674, 'two and 67/100'),
        (Decimal('0.995'), 'one and 00/100'),
        ('9.999', 'ten and 00/100'),
        (0, 'zero and 00/100'),
        (-12.345, 'minus twelve and 35/100'),
        ('-0.07', 'minus zero and 07/100'),
        ('1.999e1', 'nineteen and 99/100'),
        (1e-7, 'zero and 00/100'),
    ],
)
def test_currency(amount, expected):
    assert inflect.engine().number_to_currency(amount) == expected


@pytest.mark.parametrize('andword', ['', 'plus'])
def test_currency_andword(andword):
    p = inflect.engine()
    whole = p.number_to_words(101, andword=andword)
    assert p.number_to_currency(101.01, andword=andword) == f'{whole} and 01/100'


@pytest.mark.parametrize(
    'amount',
    [
        'ten',
        '',
        '1.2.3',
        'nan',
        'inf',
        '-Infinity',
        float('nan'),
        float('inf'),
        Decimal('NaN'),
        Decimal('sNaN'),
        Decimal('Infinity'),
        None,
    ],
)
def test_currency_invalid(amount):
    with pytest.raises(inflect.BadNumValueError):
        inflect.engine().number_to_currency(amount)


def test_currency_decimal_precision():
    p = inflect.engine()
    with localcontext() as ctx:
        ctx.prec = 3
        assert p.number_to_currency('1234.995') == (
            'one thousand, two hundred and thirty-five and 00/100'
        )
        amount = 10**30
        assert p.number_to_currency(amount) == p.number_to_words(amount) + ' and 00/100'
