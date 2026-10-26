Script ran from another dir; rerun with PYTHONPATH and add a test.

Fixed. Assigning an array of tables over a dotted-key entry no longer captures the keys after it. Your example now produces:

```
c.d = 2

[[a]]
x = 9
```

This parses back as `{"c": {"d": 2}, "a": [{"x": 9}]}`. The test suite passes (361 tests). I skipped `tests/test_toml_tests.py` because it fails at collection with a `FileNotFoundError`, which I didn't look into.

The existing code in `Container._replace_at` (`tomlkit/container.py`) already handled replacing a dotted key with a regular `[table]`. It moved the new header after any following inline entries. It never treated an array of tables as a header, so it left the new `[[a]]` where the dotted key had been. I extended the condition to cover that case.

I added a regression test, `test_replace_dotted_key_with_aot_keeps_following_dotted_keys`, in `tests/test_items.py`.

I haven't committed anything.
