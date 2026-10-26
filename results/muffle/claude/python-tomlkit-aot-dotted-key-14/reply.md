Fixed in `tomlkit/container.py` (`_replace_at`). Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

Parsing that gives `{"c": {"d": 2}, "a": [{"x": 9}]}`, which is what you expected.

The cause was that replacing a dotted key with a table already dropped the dotted key and moved the new table past the inline siblings. An array of tables skipped that handling. I extended it to cover arrays of tables.

The tests pass (360) with `tests/test_toml_tests.py` excluded. It fails at collection with a `FileNotFoundError`, so I didn't run it. I didn't add a regression test for this case.
