import copy
import pickle
import unittest
from io import StringIO

from lark import Lark, ScanMatch, TextSlice, Token, Transformer, Tree
from lark.exceptions import ConfigurationError, LexError
from lark.lexer import Lexer
from lark.tools.standalone import gen_standalone


class TestScan(unittest.TestCase):
    def test_longest_and_recovery(self):
        for lexer in ('basic', 'contextual'):
            p = Lark('start: expr+\nexpr: "(" /[a-z]/ ")"', parser='lalr', lexer=lexer)
            matches = list(p.scan('(a)(b) || (c)(d(e)'))
            self.assertEqual([m.range for m in matches], [(0, 6), (10, 13), (15, 18)])
            for match in matches:
                a, b = match.range
                self.assertEqual(match.value, p.parse('(a)(b) || (c)(d(e)'[a:b]))

    def test_options_and_positions(self):
        grammar = 'start: "(" NAME [":" NAME] ")"\nNAME: /[a-z]+/\n%ignore /\\s+/'
        text = 'bad\n (a) (b:c) xx'
        for lexer in ('basic', 'contextual'):
            for keep in (False, True):
                for placeholders in (False, True):
                    p = Lark(grammar, parser='lalr', lexer=lexer, keep_all_tokens=keep,
                             maybe_placeholders=placeholders, propagate_positions=True)
                    matches = list(p.scan(TextSlice(text, 4, 14)))
                    self.assertEqual([m.range for m in matches], [(5, 8), (9, 14)])
                    for m in matches:
                        expected = p.parse(TextSlice(text, *m.range))
                        self.assertEqual(m.value, expected)
                        for field in ('line', 'column', 'end_line', 'end_column', 'start_pos', 'end_pos'):
                            self.assertEqual(getattr(m.value.meta, field), getattr(expected.meta, field))

    def test_ignored_boundaries(self):
        p = Lark('start: "a"+\n%ignore /x+a/\n%ignore / +/', parser='lalr')
        self.assertEqual([m.range for m in p.scan('xxaa  a ')], [(2, 7)])

    def test_keyword(self):
        p = Lark('start: "if" NAME\nNAME: /[a-z]+/\n%ignore " "', parser='lalr',
                 lexer='basic', keep_all_tokens=True)
        matches = list(p.scan('??if abc!!'))
        self.assertEqual(matches, [ScanMatch((2, 8), p.parse('if abc'))])
        self.assertEqual(matches[0].value.children[0].type, 'IF')

    def test_nullable_bytes_and_adjacent(self):
        for grammar, expected in [('start: "a"*', [(1, 3), (4, 5)]), ('start:', [])]:
            for lexer in ('basic', 'contextual'):
                p = Lark(grammar, parser='lalr', lexer=lexer, use_bytes=True)
                self.assertEqual([m.range for m in p.scan(b'xaa a')], expected)
        p = Lark('start: "a"', parser='lalr')
        self.assertEqual([m.range for m in p.scan('aa')], [(0, 1), (1, 2)])

    def test_transformer_without_copy(self):
        class Value:
            def __deepcopy__(self, memo):
                raise AssertionError('must not copy transformer values')

        class T(Transformer):
            def item(self, children):
                return Value()

            def start(self, children):
                return children

        p = Lark('start: item+\nitem: "a"', parser='lalr', transformer=T())
        matches = list(p.scan('xaa!a'))
        self.assertEqual([len(m.value) for m in matches], [2, 1])
        self.assertTrue(all(isinstance(v, Value) for m in matches for v in m.value))

    def test_callbacks(self):
        def callback(t):
            if t == 'x':
                raise ValueError('invalid token')
            return t.update(value=t.upper())

        for lexer in ('basic', 'contextual'):
            p = Lark('start: A+\nA: /[ax]/', parser='lalr', lexer=lexer,
                     lexer_callbacks={'A': callback})
            self.assertEqual(list(p.scan('xaa')), [ScanMatch((1, 3), Tree('start', ['A', 'A']))])
            for error in (RuntimeError, ConfigurationError):
                def fail(t):
                    raise error('callback error')
                p = Lark('start: A\nA: "a"', parser='lalr', lexer=lexer, lexer_callbacks={'A': fail})
                with self.assertRaises(error):
                    list(p.scan('a'))
            for grammar in ('start: A', 'start: A "b"'):
                p = Lark(grammar + '\nA: "a"', parser='lalr', lexer=lexer,
                         lexer_callbacks={'A': lambda t: Token(t.type, t.value)})
                with self.assertRaisesRegex(LexError, 'did not preserve token positions'):
                    list(p.scan('ab'))

    def test_configuration_errors_are_immediate(self):
        class Custom(Lexer):
            def __init__(self, conf):
                pass
            def lex(self, data):
                return iter(())

        class Postlex:
            always_accept = ()
            def process(self, tokens):
                return tokens

        for options in ({'parser': 'earley'}, {'parser': 'cyk'}, {'parser': None, 'lexer': 'basic'},
                        {'parser': 'lalr', 'postlex': Postlex()},
                        {'parser': 'lalr', 'lexer': Custom}):
            p = Lark('start: "a"', **options)
            with self.assertRaises(ConfigurationError):
                p.scan('a')
        p = Lark('a: "a"\nb: "b"', start=['a', 'b'], parser='lalr')
        with self.assertRaises(ConfigurationError):
            p.scan('ab')
        self.assertEqual([m.range for m in p.scan('ab', start='b')], [(1, 2)])

    def test_standalone(self):
        out = StringIO()
        gen_standalone(Lark('start: "a"+', parser='lalr'), out=out)
        context = {'__name__': 'standalone_scan'}
        exec(out.getvalue(), context)
        p = context['Lark_StandAlone']()
        self.assertEqual([m.range for m in p.scan('xxaa yy a')], [(2, 4), (8, 9)])

    def test_token_copy_positions(self):
        t = Token('A', 'a', 5, 2, 3, 2, 4, 6)
        for clone in (copy.deepcopy(t), pickle.loads(pickle.dumps(t))):
            for field in ('start_pos', 'line', 'column', 'end_line', 'end_column', 'end_pos'):
                self.assertEqual(getattr(clone, field), getattr(t, field))
