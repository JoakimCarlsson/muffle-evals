Script ran outside the repo path; rerun from the repo.

Fixed in `tomlkit/container.py` (`_replace_at`). Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

Parsing that back gives `{'c': {'d': 2}, 'a': [{'x': 9}]}`, so `c` is no longer lost.

When you replace a dotted-key entry with a table that renders its own `[header]`, `_replace_at` already drops the dotted key and moves the new header after the inline siblings. An array of tables needs the same handling, so I extended that check to cover it.

I ran the test suite without `tests/test_toml_tests.py`, which fails at collection with a `FileNotFoundError` (I didn't investigate why). The other 360 tests pass. I didn't add a regression test, since you didn't ask for one.
