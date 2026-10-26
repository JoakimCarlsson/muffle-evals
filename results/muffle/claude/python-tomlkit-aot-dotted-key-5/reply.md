Script ran outside the repo; rerun from the repo with PYTHONPATH.

Fixed. Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

This parses back to `{"c": {"d": 2}, "a": [{"x": 9}]}`.

**Cause:** `Container._replace_at` in `tomlkit/container.py` already handled replacing a dotted key with a table that renders with its own `[header]`. It dropped the dotted key and moved the new header after any inline siblings. That check only covered `Table`, so an `AoT` went through the plain replace path and stayed in place, where it captured the keys after it.

**Change:** `dotted_to_header` now also applies to an `AoT` value, so the existing repositioning logic covers it.

**Tests:** I added `test_replace_dotted_key_with_aot_keeps_following_keys` to `tests/test_toml_document.py`. The other 360 tests pass. I excluded `tests/test_toml_tests.py` from that run because it fails at collection with a `FileNotFoundError`, and I didn't look into why. Nothing is committed.
