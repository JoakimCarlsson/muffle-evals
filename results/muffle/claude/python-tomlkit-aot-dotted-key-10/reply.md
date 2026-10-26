Fixed in `tomlkit/container.py` (`_replace_at`). Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

Parsing that back gives `{'c': {'d': 2}, 'a': [{'x': 9}]}`, which is the meaning you expected.

The cause was that the existing handling for replacing a dotted key with a non-super table only checked for `Table` values. It now treats an `AoT` the same way, so the array of tables is moved after the inline keys that follow it.

360 tests pass. I excluded `tests/test_toml_tests.py` because it fails at collection with a `FileNotFoundError`. I didn't investigate that. I didn't add a regression test for this case.
