Wrong file for my test's imports; moving it next to the related tests.

Fixed: assigning an array of tables over a dotted-key entry no longer captures the keys after it. Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

That parses back to `{"c": {"d": 2}, "a": [{"x": 9}]}`.

The fix is in `Container._replace_at` in `tomlkit/container.py`. It already dropped the dotted key and moved the new table past its inline siblings when you replaced a dotted key with a regular table. An array of tables takes the same path now, since it also renders under a `[[header]]`.

I added a regression test, `test_replace_dotted_key_with_aot_keeps_following_keys`, in `tests/test_toml_document.py`. The suite passes (361 tests) with `tests/test_toml_tests.py` excluded. That file errors at collection with a `FileNotFoundError`, which I didn't investigate.

I haven't committed anything.
