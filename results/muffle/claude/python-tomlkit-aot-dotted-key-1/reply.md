Script ran outside the repo; rerun from the repo with PYTHONPATH.

Let me add a regression test.

Fixed. Assigning an array of tables over a dotted key no longer captures the keys after it. Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

Parsing that back gives `{"c": {"d": 2}, "a": [{"x": 9}]}`.

The cause was in `Container._replace_at` in `tomlkit/container.py`. It already dropped the dotted key and moved the replacement past the keys that render inline when a non-super `Table` was assigned, but it skipped `AoT`. I extended that check to cover `AoT`.

I added a regression test, `test_replace_dotted_key_with_aot_does_not_capture_siblings`, in `tests/test_toml_document.py`. The suite passes (360 tests), except `tests/test_toml_tests.py`. That file fails at collection with a `FileNotFoundError`, so I excluded it from the run.

I didn't commit anything.
