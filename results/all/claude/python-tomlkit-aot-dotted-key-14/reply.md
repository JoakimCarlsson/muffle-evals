Done. `tomlkit/container.py` now treats an AoT replacing a dotted key like a non-super table, so `c.d = 2` moves ahead of `[[a]]`. Your example round-trips to `{"c": {"d": 2}, "a": [{"x": 9}]}`.

I added a regression test in `tests/test_toml_document.py`. 361 tests pass. I skipped `tests/test_toml_tests.py` because it fails at collection with `FileNotFoundError`.
