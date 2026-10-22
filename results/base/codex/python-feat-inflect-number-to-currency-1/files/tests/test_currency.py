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
        ('999.995', 'one thousand and 00/100'),
        (0, 'zero and 00/100'),
        ('1e-3', 'zero and 00/100'),
        ('1.999e2', 'one hundred and ninety-nine and 90/100'),
        (-2.675, 'minus two and 68/100'),
        ('-0.07', 'minus zero and 07/100'),
        (10**30, 'one nonillion and 00/100'),
    ],
)
def test_currency(amount, expected):
    assert inflect.engine().number_to_currency(amount) == expected


@pytest.mark.parametrize(
    'andword, whole',
    [('', 'one hundred one'), ('plus', 'one hundred plus one')],
)
def test_currency_andword(andword, whole):
    result = inflect.engine().number_to_currency(101.01, andword=andword)
    assert result == f'{whole} and 01/100'


@pytest.mark.parametrize(
    'amount',
    [
        'ten', '', 'nan', 'inf', '-Infinity',
        float('nan'), float('inf'), Decimal('sNaN'), None, object(),
    ],
)
def test_currency_invalid(amount):
    with pytest.raises(inflect.BadNumValueError):
        inflect.engine().number_to_currency(amount)


def test_currency_decimal_context():
    with localcontext() as ctx:
        ctx.prec = 2
        assert inflect.engine().number_to_currency('1234.565') == (
            'one thousand, two hundred and thirty-four and 57/100'
        )
