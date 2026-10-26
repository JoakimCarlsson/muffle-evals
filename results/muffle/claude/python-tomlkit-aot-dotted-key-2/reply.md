Fix works; adding a regression test now.

Fixed. Replacing a dotted key with an array of tables now moves the new `[[a]]` header past the keys that follow it, so `c.d` is no longer captured. Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

This parses back to `{"c": {"d": 2}, "a": [{"x": 9}]}`. I also checked a document with a plain value and a `[t]` table after the dotted keys, and the output still parses to the right structure.

**Cause:** `Container._replace_at` already dropped the dotted key and repositioned the new header when a dotted key was replaced by a non-super `Table`. It didn't do this for an `AoT`.

**Change:** the `dotted_to_header` check in `tomlkit/container.py` now also covers `AoT` values.

I added a regression test in `tests/test_toml_document.py`. The suite passes (360 tests), except that I excluded `tests/test_toml_tests.py`, which fails at collection with a `FileNotFoundError` that this change doesn't touch. I didn't add a changelog entry or commit anything.
