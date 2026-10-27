import copy
import io
import pickle
import unittest

from lark import Lark, ScanMatch, TextSlice, Token, Transformer, Tree
from lark.exceptions import ConfigurationError, LexError, UnexpectedCharacters
from lark.lexer import Lexer
from lark.tools.standalone import gen_standalone


class TestScan(unittest.TestCase):
    def test_longest_and_recovery(self):
        grammar = 'start: expr+\nexpr: "(" NAME? expr* ")"\nNAME: /[a-z]+/'
        for lexer in ('basic', 'contextual'):
            p = Lark(grammar, parser='lalr', lexer=lexer)
            matches = list(p.scan('(a)(b) || (c)(d(e)'))
            self.assertEqual([m.range for m in matches], [(0, 6), (10, 13), (15, 18)])
            for m in matches:
                self.assertEqual(m.value, p.parse('(a)(b) || (c)(d(e)'[slice(*m.range)]))

    def test_positions_and_options(self):
        text = 'outside\n  (a) (b)\nend'
        for lexer in ('basic', 'contextual'):
            for placeholders in (False, True):
                p = Lark('start: "(" [NAME] ")"\nNAME: /[a-z]+/\n%ignore " "',
                         parser='lalr', lexer=lexer, keep_all_tokens=True,
                         maybe_placeholders=placeholders, propagate_positions=True)
                matches = list(p.scan(TextSlice(text, 9, 17)))
                self.assertEqual([m.range for m in matches], [(10, 13), (14, 17)])
                for m in matches:
                    expected = p.parse(TextSlice(text, *m.range))
                    self.assertEqual(m.value, expected)
                    self.assertEqual(vars(m.value.meta), vars(expected.meta))
                    self.assertEqual(m.value.children[0].line, 2)

    def test_ignore_overlap_and_nullable(self):
        for lexer in ('basic', 'contextual'):
            p = Lark('start: "a"*\n%ignore /x+a+/', parser='lalr', lexer=lexer)
            self.assertEqual([m.range for m in p.scan('xxaa aa')], [(2, 4), (5, 7)])
            p = Lark('start: "a"*\n%ignore " "', parser='lalr', lexer=lexer)
            self.assertEqual([m.range for m in p.scan(' a a  x a ')], [(1, 4), (8, 9)])
            self.assertEqual(list(Lark('start:', parser='lalr', lexer=lexer).scan('abc')), [])

    def test_keyword(self):
        for lexer in ('basic', 'contextual'):
            p = Lark('start: "if" NAME | NAME "!"\nNAME: /[a-z]+/\n%ignore " "',
                     parser='lalr', lexer=lexer, keep_all_tokens=True)
            matches = list(p.scan('?if foo?'))
            self.assertEqual(matches, [ScanMatch((1, 7), p.parse('if foo'))])

    def test_bytes(self):
        p = Lark('start: "a"+', parser='lalr', use_bytes=True)
        self.assertEqual([m.range for m in p.scan(TextSlice(b'xaa xa', 2, 6))], [(2, 3), (5, 6)])

    def test_starts_and_configuration(self):
        p = Lark('a: "a"+\nb: "b"+', parser='lalr', start=['a', 'b'])
        with self.assertRaises(ConfigurationError):
            p.scan('aa bb')
        self.assertEqual([m.range for m in p.scan('aa bb', start='b')], [(3, 5)])
        class CustomLexer(Lexer):
            def __init__(self, conf): pass
            def lex(self, data): return iter(())
        class Postlex:
            always_accept = ()
            def process(self, stream): return stream
        for options in ({}, {'parser': None, 'lexer': 'basic'}, {'parser': 'cyk'},
                        {'parser': 'lalr', 'lexer': CustomLexer},
                        {'parser': 'lalr', 'postlex': Postlex()}):
            p = Lark('start: "a"', **options)
            with self.assertRaises(ConfigurationError):
                p.scan('a')

    def test_callbacks(self):
        def callback(t):
            if t == 'bad': raise ValueError('reject')
            return t.update(value=t.upper())
        p = Lark('start: NAME+\nNAME: /[a-z]+/\n%ignore " "', parser='lalr',
                 lexer_callbacks={'NAME': callback})
        matches = list(p.scan('bad good bad fine'))
        self.assertEqual([m.range for m in matches], [(1, 8), (10, 17)])
        self.assertEqual(str(matches[0].value.children[0]), 'AD')
        for error in (RuntimeError, ConfigurationError):
            def fail(t): raise error('failure')
            p = Lark('start: A\nA: "a"', parser='lalr', lexer_callbacks={'A': fail})
            with self.assertRaises(error): list(p.scan('a'))
        for bad_text in ('ab', 'ba'):
            def lose_position(t):
                return Token(t.type, t.value) if t == 'a' else t
            p = Lark('start: A B | B A\nA: "a"\nB: "b"', parser='lalr',
                     lexer_callbacks={'A': lose_position})
            with self.assertRaisesRegex(LexError, 'did not preserve token positions'):
                list(p.scan(bad_text))

    def test_callback_parse_error_propagates(self):
        def fail(token):
            raise UnexpectedCharacters('a', 0, 1, 1)
        p = Lark('start: A\nA: "a"', parser='lalr', lexer_callbacks={'A': fail})
        with self.assertRaises(UnexpectedCharacters):
            list(p.scan('a'))

    def test_transformer_without_copy(self):
        class Value:
            def __deepcopy__(self, memo): raise AssertionError('no copying')
        class Transform(Transformer):
            def item(self, children): return Value()
            def start(self, children): return children
        p = Lark('start: item+\nitem: "a"', parser='lalr', transformer=Transform())
        matches = list(p.scan('xaa!a'))
        self.assertEqual([len(m.value) for m in matches], [2, 1])
        self.assertIsNot(matches[0].value[0], matches[0].value[1])

    def test_token_copy(self):
        token = Token('A', 'a', 2, 3, 4, 5, 6, 7)
        for clone in (copy.deepcopy(token), pickle.loads(pickle.dumps(token))):
            for attr in ('start_pos', 'line', 'column', 'end_line', 'end_column', 'end_pos'):
                self.assertEqual(getattr(clone, attr), getattr(token, attr))

    def test_standalone(self):
        out = io.StringIO()
        gen_standalone(Lark('start: "a"+', parser='lalr'), out=out)
        namespace = {}
        exec(out.getvalue(), namespace)
        self.assertEqual([m.range for m in namespace['Lark_StandAlone']().scan('xxaa yy a')],
                         [(2, 4), (8, 9)])
