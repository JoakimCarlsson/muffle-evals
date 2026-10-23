Imports lack `aot`/`table`; use `tomlkit.` prefix.

Done. `_replace_at` in `tomlkit/container.py` now treats an AoT replacing a dotted key like a non-super table, so it moves past following inline keys. Output is `c.d = 2` then `[[a]]`, and it round-trips to `{"c": {"d": 2}, "a": [{"x": 9}]}`.

I added a test in `tests/test_toml_document.py`. The other 361 tests pass. `tests/test_toml_tests.py` is excluded because its `toml-test` fixtures are missing.
