Status: I've read the lexer, the LALR parser and the frontend code. Now writing `scan` and `ScanMatch`, and fixing the `Token` copy/pickle.

Add a focused test class to `tests/test_parser.py` (before the `_TO_TEST` machinery is fine; I'll append to `TestParsers`' sibling).

Done. `Lark.scan(text, start=None)` and `ScanMatch` (importable from `lark`) are in, and the full suite passes (1274 tests, 134 skipped).

- **Fix:** `Token` deepcopy and pickle now keep `end_line`, `end_column` and `end_pos`.
- **Tests:** I added a `TestScan` class to `tests/test_parser.py` and a standalone scan test to `tests/test_tools.py`. I ran each example from your request, including the standalone `xxaa yy a` case.
- **ValueError:** I read a callback `ValueError` as "this token is invalid", the same as a lexing failure at that spot. The scan keeps any longer match found before it and carries on. If you meant that the whole candidate start position is dropped, say so.
- **Speed:** each candidate start is lexed from scratch, so long unclosed constructs make scanning quadratic.
