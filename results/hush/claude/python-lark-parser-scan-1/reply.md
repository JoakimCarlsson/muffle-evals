Reading the code is done. I'm now writing the scan code in `lexer.py`, `parser_frontends.py` and `lark.py`.

Done. `Lark.scan` and `ScanMatch` are in, and existing tests show no failures. Standalone gives (2,4),(8,9). I added no new tests, did not run mypy, and haven't tested the `maybe_placeholders`/`keep_all_tokens` equality, the deepcopy-fail transformer, or bytes input.
