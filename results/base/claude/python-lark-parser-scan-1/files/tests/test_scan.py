import copy
import io
import pickle
from unittest import TestCase, main

from lark import Lark, Token, Tree, ScanMatch, TextSlice, Transformer, LexError
from lark.exceptions import ConfigurationError
from lark.tools import standalone

GRAMMAR = r'''
start: expr+
expr: "(" (NAME | expr)* ")"
NAME: /[a-z]+/
%ignore " "
'''
TEXT = "(a)(b) || (c)(d(e)"


class TestScan(TestCase):
    def test_basic(self):
        for lexer in ('contextual', 'basic'):
            parser = Lark(GRAMMAR, parser='lalr', lexer=lexer)
            matches = list(parser.scan(TEXT))
            self.assertEqual([m.range for m in matches], [(0, 6), (10, 13), (15, 18)])
            for m in matches:
                self.assertEqual(m.value, parser.parse(TEXT[slice(*m.range)]))

    def test_equality(self):
        self.assertEqual(ScanMatch((1, 3), Tree('expr', [])), ScanMatch((1, 3), Tree('expr', [])))
        self.assertNotEqual(ScanMatch((1, 3), Tree('expr', [])), ScanMatch((1, 4), Tree('expr', [])))

    def test_slice_and_bytes(self):
        parser = Lark(GRAMMAR, parser='lalr')
        self.assertEqual([m.range for m in parser.scan(TextSlice(TEXT, 8, 18))], [(10, 13), (15, 18)])
        self.assertEqual([m.range for m in parser.scan(TextSlice(TEXT, 0, 5))], [(0, 3)])
        parser = Lark(GRAMMAR, parser='lalr', use_bytes=True)
        self.assertEqual([m.range for m in parser.scan(TEXT.encode())], [(0, 6), (10, 13), (15, 18)])

    def test_positions(self):
        parser = Lark('start: NAME+\nNAME: /[a-z]+/\n%ignore /\\s+/', parser='lalr', propagate_positions=True)
        text = "12\n ab\n cd 3"
        (m,) = parser.scan(text)
        self.assertEqual(m.range, (4, 10))
        meta = m.value.meta
        self.assertEqual((meta.line, meta.column, meta.end_line, meta.end_column), (2, 2, 3, 4))
        self.assertEqual(meta.start_pos, 4)

    def test_empty(self):
        self.assertEqual(list(Lark('start: "a"?', parser='lalr').scan("bbb")), [])
        self.assertEqual([m.range for m in Lark('start: "a"*', parser='lalr').scan("baab")], [(1, 3)])

    def test_adjacent(self):
        parser = Lark('start: "ab"', parser='lalr')
        self.assertEqual([m.range for m in parser.scan("ababxab")], [(0, 2), (2, 4), (5, 7)])

    def test_keywords_basic(self):
        parser = Lark('start: "if" NAME\nNAME: /\\w+/\n%ignore " "', parser='lalr', lexer='basic')
        (m,) = parser.scan("x if foo yy")
        self.assertEqual(m.range, (2, 8))
        self.assertEqual(m.value, parser.parse("if foo"))

    def test_ignore_doesnt_hide(self):
        parser = Lark('start: "#" "x"\n%ignore /#.*/', parser='lalr')
        self.assertEqual([m.range for m in parser.scan("a #x")], [(2, 4)])
        parser = Lark('start: "a"\n%ignore " "', parser='lalr')
        self.assertEqual([m.range for m in parser.scan("  a  a  ")], [(2, 3), (5, 6)])

    def test_start(self):
        parser = Lark('start: a | b\na: "a"\nb: "b"', parser='lalr', start=['a', 'b'])
        with self.assertRaises(ConfigurationError):
            parser.scan("a")
        self.assertEqual([m.range for m in parser.scan("abab", 'b')], [(1, 2), (3, 4)])

    def test_configuration_errors(self):
        with self.assertRaises(ConfigurationError):
            Lark('start: "a"', parser='earley').scan("a")
        with self.assertRaises(ConfigurationError):
            Lark('start: "a"', parser=None, lexer='basic').scan("a")

        class PostLex:
            always_accept = ()
            def process(self, stream):
                return stream
        with self.assertRaisesRegex(ConfigurationError, "postlex"):
            Lark('start: "a"', parser='lalr', postlex=PostLex()).scan("a")

        from lark.lexer import BasicLexer
        class MyLexer(BasicLexer):
            pass
        with self.assertRaises(ConfigurationError):
            Lark('start: "a"', parser='lalr', lexer=MyLexer).scan("a")

    def test_callbacks(self):
        def check(t):
            if int(t) > 255:
                raise ValueError("too big")
            return t
        parser = Lark('start: INT+\nINT: /\\d+/\n%ignore " "', parser='lalr', lexer_callbacks={'INT': check})
        self.assertEqual([m.range for m in parser.scan("1 2 300 4")], [(0, 3), (5, 9)])

        def boom(t):
            raise ConfigurationError("boom")
        parser = Lark('start: INT+\nINT: /\\d+/', parser='lalr', lexer_callbacks={'INT': boom})
        with self.assertRaises(ConfigurationError):
            list(parser.scan("1"))

    def test_callback_positions(self):
        fresh = lambda t: Token(t.type, str(t))
        parser = Lark('start: INT+\nINT: /\\d+/\n%ignore " "', parser='lalr', lexer_callbacks={'INT': fresh})
        with self.assertRaisesRegex(LexError, "did not preserve token positions"):
            list(parser.scan("1 2"))

    def test_transformer(self):
        class Opaque:
            def __deepcopy__(self, memo):
                raise TypeError("no copies")

        calls = []
        class T(Transformer):
            def start(self, children):
                calls.append(list(children))
                return Opaque()

        parser = Lark('start: NAME+\nNAME: /[a-z]+/\n%ignore " "', parser='lalr', transformer=T())
        (m,) = parser.scan("12 ab cd")
        self.assertEqual(m.range, (3, 8))
        self.assertIsInstance(m.value, Opaque)
        self.assertEqual(calls, [['ab', 'cd']])

    def test_maybe_placeholders_keep_all(self):
        parser = Lark('start: "a" [NAME] "b"\nNAME: /[c-z]+/', parser='lalr', maybe_placeholders=True, keep_all_tokens=True)
        for m in parser.scan("xab abx acb"):
            self.assertEqual(m.value, parser.parse(("xab abx acb")[slice(*m.range)]))

    def test_standalone(self):
        buf = io.StringIO()
        standalone.gen_standalone(Lark('start: "a"+', parser='lalr'), out=buf)
        context = {'__name__': 'test_standalone_scan', '__doc__': None}
        exec(buf.getvalue(), context)
        self.assertEqual([m.range for m in context['Lark_StandAlone']().scan('xxaa yy a')], [(2, 4), (8, 9)])

    def test_loaded(self):
        f = io.BytesIO()
        Lark(GRAMMAR, parser='lalr').save(f)
        f.seek(0)
        self.assertEqual([m.range for m in Lark.load(f).scan(TEXT)], [(0, 6), (10, 13), (15, 18)])

    def test_token_copy(self):
        t = Token('A', 'x', 1, 2, 3, 4, 5, 6)
        for t2 in (copy.deepcopy(t), pickle.loads(pickle.dumps(t))):
            self.assertEqual((t2.start_pos, t2.line, t2.column, t2.end_line, t2.end_column, t2.end_pos), (1, 2, 3, 4, 5, 6))


if __name__ == '__main__':
    main()
