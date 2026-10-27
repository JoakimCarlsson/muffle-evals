from unittest import TestCase, main

from lark import Lark, LexError, ScanMatch, TextSlice, Token, Transformer, Tree
from lark.exceptions import ConfigurationError

GRAMMAR = r'''
start: expr+
expr: "(" (NAME | expr)* ")"
NAME: /[a-z]+/
%ignore " "
'''


class TestScan(TestCase):
    def test_ranges(self):
        for lexer in ('contextual', 'basic'):
            p = Lark(GRAMMAR, parser='lalr', lexer=lexer)
            self.assertEqual([m.range for m in p.scan("(a)(b) || (c)(d(e)")], [(0, 6), (10, 13), (15, 18)])

    def test_equality(self):
        self.assertEqual(ScanMatch((1, 3), Tree('expr', [])), ScanMatch((1, 3), Tree('expr', [])))

    def test_slice_and_empty(self):
        p = Lark('start: "a"+', parser='lalr')
        self.assertEqual([m.range for m in p.scan('xxaa yy a')], [(2, 4), (8, 9)])
        self.assertEqual([m.range for m in p.scan(TextSlice('xxaa yy a', 3, 9))], [(3, 4), (8, 9)])
        p = Lark('start: "a"*', parser='lalr')
        self.assertEqual([m.range for m in p.scan('baab')], [(1, 3)])

    def test_ignore_does_not_hide_start(self):
        p = Lark('start: "a"\n%ignore /#.*/', parser='lalr')
        self.assertEqual([m.range for m in p.scan('#a')], [(1, 2)])

    def test_keyword_in_basic_lexer(self):
        p = Lark('start: "if" NAME\nNAME: /[a-z]+/\n%ignore " "', parser='lalr', lexer='basic')
        (m,) = p.scan('zz if abc')
        self.assertEqual(m, ScanMatch((3, 9), p.parse('if abc')))

    def test_positions(self):
        p = Lark('start: "a" "b"', parser='lalr', propagate_positions=True)
        meta = [(m.value.meta.line, m.value.meta.column, m.value.meta.end_line, m.value.meta.end_column)
                for m in p.scan('x\nab\nab')]
        self.assertEqual(meta, [(2, 1, 2, 3), (3, 1, 3, 3)])

    def test_configuration_errors(self):
        class PostLex:
            always_accept = ()
            def process(self, stream):
                return stream
        with self.assertRaises(ConfigurationError):
            Lark('start: "a"', parser='earley').scan('a')
        with self.assertRaises(ConfigurationError):
            Lark('start: "a"', parser=None, lexer='basic').scan('a')
        with self.assertRaisesRegex(ConfigurationError, 'postlex'):
            Lark('start: "a"', parser='lalr', postlex=PostLex()).scan('a')
        p = Lark('start: "a"\nother: "b"', parser='lalr', start=['start', 'other'])
        with self.assertRaises(ConfigurationError):
            p.scan('a')
        self.assertEqual([m.range for m in p.scan('ab', start='other')], [(1, 2)])

    def test_callbacks(self):
        def lose_positions(t):
            return Token('A', str(t))
        p = Lark('start: A B\nA: "a"\nB: "b"', parser='lalr', lexer_callbacks={'A': lose_positions})
        with self.assertRaisesRegex(LexError, 'did not preserve token positions'):
            list(p.scan('ab'))

        def reject_x(t):
            if t == 'x':
                raise ValueError()
            return t
        p = Lark('start: A+\nA: /[a-z]/', parser='lalr', lexer_callbacks={'A': reject_x})
        self.assertEqual([m.range for m in p.scan('abxcd')], [(0, 2), (3, 5)])

    def test_transformer_not_copied(self):
        class Uncopyable:
            def __deepcopy__(self, memo):
                raise RuntimeError()

        class T(Transformer):
            def start(self, children):
                return Uncopyable()
        p = Lark('start: "a"+', parser='lalr', transformer=T())
        (m,) = p.scan('xaab')
        self.assertEqual(m.range, (1, 3))
        self.assertIsInstance(m.value, Uncopyable)

    def test_token_copy_keeps_end(self):
        import copy, pickle
        t = Token('A', 'a', 1, 2, 3, 4, 5, 6)
        for c in (copy.deepcopy(t), pickle.loads(pickle.dumps(t))):
            self.assertEqual((c.end_line, c.end_column, c.end_pos), (4, 5, 6))


if __name__ == '__main__':
    main()
