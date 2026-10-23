Fixed. Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

This parses back to `{"c": {"d": 2}, "a": [{"x": 9}]}`.

The change is in `Container._replace_at` in `tomlkit/container.py`. It already handled a dotted key being replaced by a non-super `Table`, but it skipped an `AoT`. Now an `AoT` goes through the same path, so `[[a]]` is moved after the keys that render inline.

I added a regression test in `tests/test_toml_document.py`. The suite passes (360 tests) except `tests/test_toml_tests.py`, which I excluded because it fails at collection with a `FileNotFoundError`. I didn't look into why.

I haven't committed anything.
