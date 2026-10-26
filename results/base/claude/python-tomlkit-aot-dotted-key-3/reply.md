Works. Adding a regression test and removing scratch.

I fixed it. Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

Parsing that back gives `{"c": {"d": 2}, "a": [{"x": 9}]}`, as you expected. The test suite passes, except `tests/test_toml_tests.py`. I left that file out because it fails to collect with a `FileNotFoundError`, which I didn't look into.

The cause was in `Container._replace_at` in `tomlkit/container.py`. It already handled a dotted key being replaced by a regular table. It dropped the dotted key and moved the new header past any keys that render inline. It skipped arrays of tables, so the `[[a]]` header stayed in place and captured `c.d`. I extended that check to cover arrays of tables.

I added a regression test, `test_replace_dotted_key_with_aot_keeps_following_keys`, in `tests/test_toml_document.py`.

I haven't committed anything.
