from unittest import TestCase, main

from lark import Lark, Tree, TextSlice, ScanMatch, Token, Transformer, LexError
from lark.exceptions import ConfigurationError, UnexpectedToken
from lark.lexer import Lexer
from copy import deepcopy
import pickle
import itertools


class TestLexer(TestCase):
    def setUp(self):
        pass

    def test_basic(self):
        p = Lark("""
            start: "a" "b" "c" "d"
            %ignore " "
        """)

        res = list(p.lex("abc cba dd"))
        assert res == list('abccbadd')

        res = list(p.lex("abc cba dd", dont_ignore=True))
        assert res == list('abc cba dd')

    def test_subset_lex(self):
        p = Lark("""
            start: "a" "b" "c" "d"
            %ignore " "
        """)

        res = list(p.lex(TextSlice("xxxabc cba ddxx", 3, -2)))
        assert res == list('abccbadd')

        res = list(p.lex(TextSlice("aaaabc cba dddd", 3, -2)))
        assert res == list('abccbadd')


class TestScan(TestCase):
    def test_matches(self):
        """Scan longest prefixes, recover inside failures, and allow adjacent matches."""
        for lexer in ('basic', 'contextual'):
            p = Lark('start: expr+\nexpr: "(" /[a-z]/ ")"', parser='lalr', lexer=lexer)
            self.assertEqual([m.range for m in p.scan('(a)(b) || (c)(d(e)')],
                             [(0, 6), (10, 13), (15, 18)])
            p = Lark('start: "a" "b"', parser='lalr', lexer=lexer)
            self.assertEqual([m.range for m in p.scan('abab')], [(0, 2), (2, 4)])
            self.assertEqual(list(p.scan('')), [])
            self.assertEqual(ScanMatch((1, 3), Tree('expr', [])),
                             ScanMatch((1, 3), Tree('expr', [])))

    def test_options_positions_and_bytes(self):
        """Match parse values and absolute metadata for slices and both text types."""
        grammar = 'start: A ["b"]\nA: "a"\n%ignore " "'
        for lexer, keep, placeholders, positions, use_bytes in itertools.product(
                ('basic', 'contextual'), (False, True), (False, True), (False, True), (False, True)):
            p = Lark(grammar, parser='lalr', lexer=lexer, keep_all_tokens=keep,
                     maybe_placeholders=placeholders, propagate_positions=positions, use_bytes=use_bytes)
            text = b'xx\n a b zz a' if use_bytes else 'xx\n a b zz a'
            matches = list(p.scan(TextSlice(text, 3, 9)))
            self.assertEqual([m.range for m in matches], [(4, 7)])
            expected = p.parse(TextSlice(text, 4, 7))
            self.assertEqual(matches[0].value, expected)
            if positions:
                self.assertEqual(vars(matches[0].value.meta), vars(expected.meta))
                self.assertEqual((expected.meta.line, expected.meta.column, expected.meta.end_pos), (2, 2, 7))

    def test_ignored_nullable_and_keywords(self):
        """Ignore boundaries, nullable starts, and folded keywords retain parse semantics."""
        for lexer in ('basic', 'contextual'):
            p = Lark('start: "a"+\n%ignore /x+a/\n%ignore " "', parser='lalr', lexer=lexer)
            self.assertEqual([m.range for m in p.scan('xxaa aa ')], [(2, 7)])
            p = Lark('start: "a"*', parser='lalr', lexer=lexer)
            self.assertEqual([m.range for m in p.scan('xaax')], [(1, 3)])
            self.assertEqual(list(Lark('start:', parser='lalr', lexer=lexer).scan('abc')), [])
            p = Lark('start: "if" NAME\nNAME: /[a-z]+/\n%ignore " "', parser='lalr', lexer=lexer)
            self.assertEqual(list(p.scan('!if name!')),
                             [ScanMatch((1, 8), p.parse('if name'))])

    def test_configuration(self):
        """Unsupported configurations fail before iteration, and starts are scoped."""
        class Custom(Lexer):
            def __init__(self, conf):
                """Accept lexer configuration."""
            def lex(self, data):
                """Return no tokens."""
                return iter(())
        class Postlex:
            always_accept = ()
            def process(self, stream):
                """Pass tokens through."""
                return stream
        for options in ({'parser': 'earley'}, {'parser': 'cyk'}, {'parser': None, 'lexer': 'basic'},
                        {'parser': 'lalr', 'postlex': Postlex()},
                        {'parser': 'lalr', 'lexer': Custom}):
            p = Lark('start: "a"', **options)
            with self.assertRaises(ConfigurationError):
                p.scan('a')
        p = Lark('a: "a"\nb: "b"', parser='lalr', start=['a', 'b'])
        self.assertRaises(ConfigurationError, p.scan, 'ab')
        self.assertEqual([m.range for m in p.scan('ab', start='b')], [(1, 2)])

    def test_callbacks(self):
        """Retain callback values, reject invalid tokens, and propagate other errors."""
        def update(t):
            """Change token value without changing positions."""
            return t.update(value='changed')
        p = Lark('start: A+\nA: "a"', parser='lalr', lexer_callbacks={'A': update})
        self.assertEqual(list(p.scan('xaa'))[0].value, p.parse('aa'))
        def reject(t):
            """Reject a token at the first position."""
            if t.start_pos == 0:
                raise ValueError('invalid')
            return t
        p = Lark('start: A\nA: "a"', parser='lalr', lexer_callbacks={'A': reject})
        self.assertEqual([m.range for m in p.scan('aa')], [(1, 2)])
        for error in (RuntimeError, ConfigurationError):
            def fail(t):
                """Raise the selected callback exception."""
                raise error('callback')
            p = Lark('start: A\nA: "a"', parser='lalr', lexer_callbacks={'A': fail})
            self.assertRaises(error, list, p.scan('a'))
        def parse_error(t):
            """Propagate parse errors raised by user callbacks."""
            raise UnexpectedToken(t, {'B'})
        p = Lark('start: A\nA: "a"', parser='lalr', lexer_callbacks={'A': parse_error})
        self.assertRaises(UnexpectedToken, list, p.scan('a'))
        for terminal in ('A', 'B'):
            p = Lark('start: A B\nA: "a"\nB: "b"', parser='lalr',
                     lexer_callbacks={terminal: lambda t: Token(t.type, t.value)})
            with self.assertRaisesRegex(LexError, 'did not preserve token positions'):
                list(p.scan('ab'))

    def test_transformer(self):
        """Transform only accepted matches without copying transformer values."""
        class Value:
            def __deepcopy__(self, memo):
                """Disallow copying this value."""
                raise RuntimeError('cannot copy')
        class Transform(Transformer):
            def item(self, children):
                """Return an opaque value."""
                return Value()
            def start(self, children):
                """Return the matched values."""
                return children
        p = Lark('start: item+\nitem: "a"', parser='lalr', transformer=Transform())
        matches = list(p.scan('xaa!a'))
        self.assertEqual([m.range for m in matches], [(1, 3), (4, 5)])
        self.assertEqual([len(m.value) for m in matches], [2, 1])
        self.assertTrue(all(isinstance(v, Value) for m in matches for v in m.value))

    def test_token_copy(self):
        """Copies retain every source position."""
        token = Token('A', 'a', 4, 2, 3, 2, 4, 5)
        for clone in (deepcopy(token), pickle.loads(pickle.dumps(token))):
            for field in ('start_pos', 'line', 'column', 'end_line', 'end_column', 'end_pos'):
                self.assertEqual(getattr(clone, field), getattr(token, field))


if __name__ == '__main__':
    main()
