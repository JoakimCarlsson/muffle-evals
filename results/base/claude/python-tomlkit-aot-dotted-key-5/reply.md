Works. Adding a regression test.

Fixed. Assigning an array of tables over a dotted-key entry no longer captures the keys after it. Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

This parses back to `{"c": {"d": 2}, "a": [{"x": 9}]}`.

`Container._replace_at` in `tomlkit/container.py` already had handling for replacing a dotted key with a regular table (#524/#513). It dropped the dotted key and moved the new header past the inline siblings. That check only matched `Table`, so an `AoT` skipped it. I extended the check to cover `AoT`.

I added a regression test in `tests/test_toml_document.py`. The suite passes (361 tests). I had to skip `tests/test_toml_tests.py`, which fails at collection with a `FileNotFoundError` (a data file isn't present). Nothing is committed.
