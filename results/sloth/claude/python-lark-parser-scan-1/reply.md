I'll start by looking at the codebase.

Reading is done. I'm adding `scan` to `ParsingFrontend`, `Lark` and `utils` now, then I'll write the tests.

The append landed after the closing `###}` marker, so it would be left out of the standalone build. I'll move the marker.

First pass works. Now I'll tidy the search callbacks and check the remaining requirements: config errors, callbacks, positions, and `bytes`/`TextSlice` input.

`parser=None` raised an `AssertionError` instead of `ConfigurationError`. I'll find where it comes from.

The `AssertionError` is just the constructor rejecting `parser=None` without a lexer, and with `lexer='basic'` the error is correct. Now the standalone build.

`-I` skipped the working directory, so `import sa` failed. I'll run it by path instead.

Standalone works. Next I'll add the tests.

`PostLex1` doesn't exist, and I left some `if 0` scaffolding in the tests. I'll fix both.

The `bytes` failure is my test: it needs `use_bytes=True`, same as `parse()`. Here are the other two failures.

Two errors in the full run. I'm checking whether I caused them.

`Lark.scan(text, start=None)` and `ScanMatch` are in, and `ScanMatch` is importable from `lark`. The full suite shows the same two import errors (`test_nearley`, `test_typing`) with my changes stashed. Both are missing-dependency or cwd problems, not mine. The 10 new tests pass (`TestScan` plus the standalone test) and nothing else regressed. I checked every example in your request, including the `(a)(b) || (c)(d(e)` ranges and the standalone `scan('xxaa yy a')` → `(2, 4)`, `(8, 9)`. I didn't run mypy, so the `Lark[T].scan` typing is untested.

**Search.** `scan()` rejects bad configurations when you call it, not when you iterate. At each position where a first token can start, it tokenizes and feeds a copy of the parser state. It remembers the longest prefix that can end the start rule and then parses that. Lexer callbacks run during the search; the transformer runs only on the match that is returned, so values that can't be deep-copied work.

**Where things are.**
- `lark/parser_frontends.py`: the search itself.
- `lark/lark.py`: the public `scan()`.
- `lark/utils.py`: `ScanMatch`.
- `lark/lexer.py`: `Token` deepcopy and pickle now keep `end_line`, `end_column` and `end_pos`.
- Tests: `TestScan` in `tests/test_parser.py` and one standalone test in `tests/test_tools.py`.

**Choices I made where your spec was open:**
- A `ValueError` from a callback ends the candidate at that token. Any prefix before it that already parses is still a match, and later positions are scanned normally.
- Skipping an invalid token moves the scan forward one character, like a regex. With `W: /[a-z]+/` and a callback rejecting `bad`, scanning `a bad` also yields `ad`.
- `bytes` input needs `use_bytes=True` on the Lark instance, the same as `parse()`.

I didn't add docs or a changelog entry.

I haven't committed anything.
