import copy
import io
import pickle
import unittest

from lark import Lark, ScanMatch, TextSlice, Token, Transformer, Tree
from lark.exceptions import ConfigurationError, LexError
from lark.tools.standalone import gen_standalone


class TestScan(unittest.TestCase):
    def test_search(self):
        for lexer in ('basic', 'contextual'):
            p = Lark('start: expr+\nexpr: "(" /[a-z]/ expr* ")"',
                     parser='lalr', lexer=lexer)
            self.assertEqual([m.range for m in p.scan('(a)(b) || (c)(d(e)')],
                             [(0, 6), (10, 13), (15, 18)])

    def test_slice_options(self):
        for lexer in ('basic', 'contextual'):
            for placeholders in (False, True):
                p = Lark('start: "a" ["b"]\n%ignore / +/', parser='lalr',
                         lexer=lexer, keep_all_tokens=True,
                         maybe_placeholders=placeholders, propagate_positions=True)
                text = '\nxx a b yy a zz'
                matches = list(p.scan(TextSlice(text, 3, 13)))
                self.assertEqual([m.range for m in matches], [(4, 7), (11, 12)])
                for m in matches:
                    expected = p.parse(TextSlice(text, *m.range))
                    self.assertEqual(m.value, expected)
                    self.assertEqual(vars(m.value.meta), vars(expected.meta))

    def test_nullable_bytes_and_ignore(self):
        p = Lark('start: "a"*', parser='lalr', use_bytes=True)
        self.assertEqual([m.range for m in p.scan(b'xxaa a')], [(2, 4), (5, 6)])
        self.assertEqual(list(Lark('start:', parser='lalr').scan('abc')), [])
        p = Lark('start: "a"+\n%ignore /x[a ]+/', parser='lalr')
        self.assertEqual([m.range for m in p.scan('xaa a')], [(1, 3), (4, 5)])

    def test_start_and_configuration(self):
        p = Lark('a: "a"\nb: "b"', parser='lalr', start=['a', 'b'])
        with self.assertRaises(ConfigurationError):
            p.scan('ab')
        self.assertEqual([m.range for m in p.scan('ab', 'b')], [(1, 2)])
        for parser in ('earley', 'cyk', None):
            with self.assertRaises(ConfigurationError):
                Lark('start: "a"', parser=parser, lexer='basic').scan('a')

    def test_callbacks(self):
        def invalid(t):
            if t == 'b':
                raise ValueError('invalid')
            return t.update(value=t.upper())
        p = Lark('start: LETTER+\nLETTER: /[ab]/', parser='lalr',
                 lexer_callbacks={'LETTER': invalid})
        self.assertEqual(list(p.scan('aba')), [
            ScanMatch((0, 1), p.parse('a')), ScanMatch((2, 3), p.parse('a'))])
        def bad(t):
            return Token(t.type, t.value)
        p = Lark('start: A "b"\nA: "a"', parser='lalr', lexer_callbacks={'A': bad})
        with self.assertRaisesRegex(LexError, 'did not preserve token positions'):
            list(p.scan('ab'))
        def error(t):
            raise ConfigurationError('callback error')
        p = Lark('start: A\nA: "a"', parser='lalr', lexer_callbacks={'A': error})
        with self.assertRaises(ConfigurationError):
            list(p.scan('a'))

    def test_transformer(self):
        class Value:
            def __deepcopy__(self, memo):
                raise TypeError('cannot copy')
        class Transform(Transformer):
            def item(self, children):
                return Value()
            def start(self, children):
                return children
        p = Lark('start: item+\nitem: "a"', parser='lalr', transformer=Transform())
        self.assertEqual(len(list(p.scan('aa!a'))[0].value), 2)

    def test_keyword(self):
        p = Lark('start: "if" | NAME ":"\nNAME: /[a-z]+/', parser='lalr', lexer='basic', keep_all_tokens=True)
        self.assertEqual(list(p.scan('!if!')), [ScanMatch((1, 3), p.parse('if'))])
        self.assertEqual([m.range for m in p.scan('!ifxx')], [(1, 3)])

    def test_standalone(self):
        out = io.StringIO()
        gen_standalone(Lark('start: "a"+', parser='lalr'), out=out)
        namespace = {}
        exec(out.getvalue(), namespace)
        self.assertEqual([m.range for m in namespace['Lark_StandAlone']().scan('xxaa yy a')],
                         [(2, 4), (8, 9)])

    def test_token_copy(self):
        t = Token('A', 'a', 4, 2, 3, 2, 4, 5)
        for cloned in (copy.deepcopy(t), pickle.loads(pickle.dumps(t))):
            for attr in Token.__slots__:
                self.assertEqual(getattr(cloned, attr), getattr(t, attr))
