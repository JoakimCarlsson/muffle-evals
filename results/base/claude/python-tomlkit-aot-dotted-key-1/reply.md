Now a regression test, then run the suite (ignoring the collection error from the missing toml-test data).

Your example now round-trips as `{"c": {"d": 2}, "a": [{"x": 9}]}`. The dump is:

```
c.d = 2

[[a]]
x = 9
```

The fix is in `tomlkit/container.py`, in `_replace_at`. That function already handled a dotted key being replaced by a non-super `Table`. It dropped the dotted key and moved the new table past the inline siblings. It didn't do the same when the replacement was an array of tables, so the `[[a]]` header stayed in place and picked up `c.d = 2`. It now treats both cases the same.

I added a regression test in `tests/test_toml_document.py`. The suite passes (361 tests). I had to skip `tests/test_toml_tests.py`, which fails at collection with a `FileNotFoundError`; I didn't look into why.

I left the changes uncommitted.
