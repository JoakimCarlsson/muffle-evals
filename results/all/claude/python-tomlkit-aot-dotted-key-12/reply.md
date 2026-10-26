Fix works. Adding test, then running suite.

Done. `doc["a"] = aot` over a dotted key now drops the dotted key and moves the `[[a]]` header after the inline siblings. Your example outputs `c.d = 2` followed by `[[a]]`, and it parses back as `{"c": {"d": 2}, "a": [{"x": 9}]}`. The change is in `tomlkit/container.py` (`_replace_at`).

I added `test_replace_dotted_key_with_aot_keeps_following_sibling`. The other 361 tests pass. I skipped `tests/test_toml_tests.py` because it fails at collection with a `FileNotFoundError`.
