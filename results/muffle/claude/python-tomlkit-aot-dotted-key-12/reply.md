Fixed: assigning an array of tables over a dotted key no longer captures the keys after it. Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

Parsing that back gives `{"c": {"d": 2}, "a": [{"x": 9}]}`. I added a regression test in `tests/test_toml_document.py`. The suite passes (361 tests) when run without `tests/test_toml_tests.py`. That file fails at collection with a `FileNotFoundError`, so I excluded it and didn't investigate why.

The change is in `Container._replace_at` in `tomlkit/container.py`. It already handled a dotted key being replaced by a regular table, by dropping the dotted key and moving the new header past the keys that render inline. It skipped arrays of tables, so I extended that check to cover them.

I haven't committed anything.
