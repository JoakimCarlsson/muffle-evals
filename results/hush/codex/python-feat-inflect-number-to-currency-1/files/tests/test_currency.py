from decimal import Decimal, localcontext

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
        ('1e3', 'one thousand and 00/100'),
        (-0.07, 'minus zero and 07/100'),
        ('-2.675', 'minus two and 68/100'),
        (0, 'zero and 00/100'),
    ],
)
def test_currency(amount, expected):
    assert inflect.engine().number_to_currency(amount) == expected


@pytest.mark.parametrize('andword', ['', 'plus'])
def test_currency_andword(andword):
    engine = inflect.engine()
    whole = engine.number_to_words(101, andword=andword)
    assert engine.number_to_currency(101.01, andword=andword) == f'{whole} and 01/100'


@pytest.mark.parametrize(
    'amount',
    ['ten', '', 'nan', 'inf', '-Infinity', float('nan'), float('inf'),
     Decimal('NaN'), Decimal('sNaN'), Decimal('Infinity'), None, complex(1, 2)],
)
def test_currency_invalid(amount):
    with pytest.raises(inflect.BadNumValueError):
        inflect.engine().number_to_currency(amount)


def test_currency_decimal_context():
    with localcontext() as context:
        context.prec = 2
        assert inflect.engine().number_to_currency('1234.995') == (
            'one thousand, two hundred and thirty-five and 00/100'
        )
