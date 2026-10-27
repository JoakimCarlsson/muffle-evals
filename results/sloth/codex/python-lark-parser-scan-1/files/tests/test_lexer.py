from unittest import TestCase, main

from lark import Lark, Tree, TextSlice


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

    def test_token_copy_positions(self):
        """Deepcopy and pickle preserve every source coordinate."""
        import pickle
        from copy import deepcopy
        from lark import Token
        token = Token('A', 'a', 4, 2, 3, 2, 4, 5)
        for copied in (deepcopy(token), pickle.loads(pickle.dumps(token))):
            self.assertEqual(copied, token)
            for field in Token.__slots__:
                self.assertEqual(getattr(copied, field), getattr(token, field))


if __name__ == '__main__':
    main()
