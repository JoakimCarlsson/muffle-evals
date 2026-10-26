Fix works and tests pass; now adding a regression test and changelog entry.

Assigning an array of tables over a dotted-key entry no longer captures the keys after it. Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

Re-parsing that gives `{"c": {"d": 2}, "a": [{"x": 9}]}`. The test suite passes (361 tests), but I excluded `tests/test_toml_tests.py`, which fails at collection with a `FileNotFoundError`.

**Cause:** `Container._replace_at` already handled a dotted key being replaced by a non-super table (#524, #513). An array of tables (AoT) wasn't covered. The old dotted key was kept and the AoT stayed in its original position, so `[[a]]` ended up before `c.d = 2` and swallowed it.

**Fix:** In `tomlkit/container.py`, an AoT now takes the same path as a non-super table. The dotted key is dropped, and the AoT is moved after any following inline entries.

I also added a regression test in `tests/test_toml_document.py` and a "Fixed" entry in `CHANGELOG.md`. I didn't commit anything.
