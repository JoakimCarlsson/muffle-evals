Fix works; now adding a regression test and cleaning up my scratch file.

Assigning an array of tables over a dotted key no longer captures the keys that follow it. Your example now produces:

```
c.d = 2

[[a]]
x = 9
```

This parses back to `{"c": {"d": 2}, "a": [{"x": 9}]}`. I also checked a case with a following `[z]` table and one where the dotted key was the only key. Both round-trip correctly, and the test suite passes (361 tests). I excluded `tests/test_toml_tests.py` because it fails at collection with a `FileNotFoundError`, which I didn't look into.

The fix is in `_replace_at` in `tomlkit/container.py`. There was already handling for replacing a dotted key with a table that gets its own `[header]` (#513, #524). It didn't cover arrays of tables, which always render with a header. I extended it so an array of tables is treated the same way: it drops the dotted key and moves the new entry past the keys that render inline.

I added a regression test in `tests/test_toml_document.py` and a "Fixed" entry in `CHANGELOG.md`. I haven't committed anything.
