Applying the edits now: `ScanMatch`, the `Token` copy fix, `Lark.scan` and the frontend search.

`Lark.scan(text, start=None)` is in and works, and the full test suite passes, including the new `tests/test_scan.py`. I couldn't run mypy (it isn't installed here), so the generic typing (`Lark[T].scan(...)` giving `ScanMatch[T]`) is unchecked. Nothing is committed.

**Where the code is**
- `ScanMatch` is a frozen generic dataclass in `lark/utils.py`, with `range` and `value`, and is exported from `lark`.
- `Lark.scan` in `lark/lark.py` raises `ConfigurationError` at the call for a non-LALR parser, `parser=None`, a `postlex` (the message mentions it) or a custom lexer. It also raises it when there are several start symbols and `start` is missing.
- The search lives in `lark/parser_frontends.py`, so it is in the generated standalone parser too. `Lark_StandAlone().scan('xxaa yy a')` gives `(2, 4)` and `(8, 9)`.
- `Token` deepcopy and pickle now keep `end_line`, `end_column` and `end_pos` (`lark/lexer.py`).
- I added the `ScanMatch` class and `scan` to `docs/classes.rst`, and the new tests are registered in `tests/__main__.py`.

**How it works**
- From each start offset it lexes forward with the real lexer, tracking only the parser state stack, and records the last point where the parser could accept end of input. The match ends at the end of the last non-ignored token there, so empty matches are never produced.
- The first token is lexed with the `%ignore` terminals removed, so an ignore pattern can't hide a match start and a match never starts with an ignored token.
- The returned value comes from re-feeding the matched tokens through the real parser callbacks, with line, column and end positions relative to the whole text. So the transformer runs only for the returned match. Values are never deep-copied, so a transformer whose values can't be copied works.

**Decisions to check**
- A `ValueError` from a callback ends the candidate at that token, like a lex error. An earlier valid prefix can still match, and scanning continues after it. `ConfigurationError` is a `ValueError` subclass, so it is explicitly re-raised.
- The transformer's terminal callbacks also run during the search, so a `ValueError` from one skips that token too. For tokens in the returned match, they run twice: once while searching and once when the value is built.
- Match ends fall on token boundaries of a lex started at the match start. For example, with `start: "if"`, text `iffy` does not match, because the lexer reads `iffy` as one token.
