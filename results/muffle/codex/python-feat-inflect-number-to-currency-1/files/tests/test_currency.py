from decimal import Decimal, Inexact, localcontext

import pytest

import inflect


@pytest.mark.parametrize(
    ('amount', 'expected'),
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
        (-2.675, 'minus two and 68/100'),
        ('-0.07', 'minus zero and 07/100'),
        ('1.234e3', 'one thousand, two hundred and thirty-four and 00/100'),
        (1e-7, 'zero and 00/100'),
        ('1234567890123456789012345678.995', None),
    ],
)
def test_currency(amount, expected):
    p = inflect.engine()
    if expected is None:
        expected = p.number_to_words('1234567890123456789012345679') + ' and 00/100'
    assert p.number_to_currency(amount) == expected


@pytest.mark.parametrize('andword', ['', 'plus'])
def test_currency_andword(andword):
    p = inflect.engine()
    expected = p.number_to_words(101, andword=andword) + ' and 01/100'
    assert p.number_to_currency(101.01, andword=andword) == expected


@pytest.mark.parametrize(
    'amount',
    [
        'ten',
        '',
        '1.2.3',
        'nan',
        'sNaN',
        'inf',
        '-Infinity',
        float('nan'),
        float('inf'),
        Decimal('NaN'),
        Decimal('Infinity'),
        None,
    ],
)
def test_currency_invalid(amount):
    with pytest.raises(inflect.BadNumValueError):
        inflect.engine().number_to_currency(amount)


def test_currency_decimal_context():
    with localcontext() as ctx:
        ctx.prec = 2
        ctx.traps[Inexact] = True
        assert inflect.engine().number_to_currency('1234.995') == (
            'one thousand, two hundred and thirty-five and 00/100'
        )
