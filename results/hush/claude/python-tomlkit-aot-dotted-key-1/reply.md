Extend the dotted check to AoT.

Done. `tomlkit/container.py` `_replace_at`: dotted-key check now includes `AoT`, so `c.d = 2` stays top-level and `[[a]]` goes after it. Your example round-trips to `{"c": {"d": 2}, "a": [{"x": 9}]}`. 360 tests pass. `tests/test_toml_tests.py` skipped (missing files). I added no regression test.
