I deleted the script too early; I'll rerun it with PYTHONPATH set.

Add a regression test.

The file didn't exist; I'll put the test in an existing file.

Fixed: assigning an array of tables over a dotted key no longer captures the keys after it. Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

Parsing that back gives `{"c": {"d": 2}, "a": [{"x": 9}]}`.

The bug was in `Container._replace_at` in `tomlkit/container.py`. It already handled a dotted key being replaced by a regular table, which gets its own `[header]`. It did this by dropping the dotted key and moving the new table past any following inline keys. An `AoT` skipped that path. I extended the condition to cover `AoT` as well.

I added a regression test in `tests/test_toml_document.py`. The suite passes (361 tests) with `tests/test_toml_tests.py` excluded. That file fails at collection with a `FileNotFoundError`, and I didn't look into why.

I haven't committed anything.
