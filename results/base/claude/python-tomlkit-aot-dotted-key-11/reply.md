Extend the dotted-key handling to AoT.

Works. Add a test and run the suite.

Fixed: your example now outputs `c.d = 2` first, then `[[a]]` / `x = 9`. Parsing that gives `{"c": {"d": 2}, "a": [{"x": 9}]}`, so `c` is no longer lost.

When a dotted key was replaced by a regular table, `Container._replace_at` already dropped the dotted key and moved the new table past the keys that follow it. It never did this for an array of tables, so the `[[a]]` header stayed in place and swallowed `c.d`. I changed the check in `tomlkit/container.py` to cover arrays of tables too.

I added a regression test in `tests/test_api.py` using your example. The suite passes with 361 tests. I excluded `tests/test_toml_tests.py` because it fails at collection with a `FileNotFoundError`, which I didn't look into.

I haven't committed anything.
