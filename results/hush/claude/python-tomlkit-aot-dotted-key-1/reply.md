Script ran from outside the repo; I deleted it. Rerun with PYTHONPATH.

Done. In `tomlkit/container.py` `_replace_at`, an AoT replacing a dotted key now gets the same handling as a non-super table, so `c.d = 2` stays before `[[a]]`. Your example now parses back to `{"c": {"d": 2}, "a": [{"x": 9}]}`. The 360 tests pass, but I skipped `tests/test_toml_tests.py` because it fails at collection with a missing-file error. I added no regression test.
