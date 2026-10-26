Script ran from another dir; rerun with PYTHONPATH.

Works. Adding a regression test.

Fixed: assigning an array of tables over a dotted-key entry no longer captures the keys after it. Your example now dumps as `c.d = 2` followed by `[[a]]` with `x = 9`, and parsing that gives `{"c": {"d": 2}, "a": [{"x": 9}]}`. I also tried a variant with a plain key and a following `[z]` table, which came out right too.

**Cause:** `Container._replace_at` in `tomlkit/container.py` already had handling for replacing a dotted key with a regular table. It dropped the dotted key and moved the new header past any inline siblings. That check only looked for `Table`, so an `AoT` skipped it and its `[[a]]` header was left in front of `c.d = 2`. I extended the check to cover `AoT` as well.

**Tests:** I added a regression test, `test_replace_dotted_key_with_aot_keeps_following_keys`, to `tests/test_api.py`. The suite passes (360 tests), but I excluded `tests/test_toml_tests.py`, which fails at collection with a `FileNotFoundError` in this checkout. I didn't look into why.

I haven't committed anything.
