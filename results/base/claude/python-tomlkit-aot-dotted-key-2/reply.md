Fix works; I'll add a regression test now.

Fixed. Assigning an array of tables over a dotted-key entry no longer captures the keys after it. Your example now dumps as:

```
c.d = 2

[[a]]
x = 9
```

This re-parses to `{"c": {"d": 2}, "a": [{"x": 9}]}`.

The cause was in `Container._replace_at` in `tomlkit/container.py`. It already handled a dotted key being replaced by a non-super table (the #524 and #513 cases), but not by an `AoT`. I extended that check to cover `AoT` as well. The new `[[a]]` header is now moved past the keys that render inline.

I added a regression test, `test_replace_dotted_key_with_aot_keeps_following_keys` in `tests/test_api.py`. The suite passes (360 tests), but I excluded `tests/test_toml_tests.py`, which errors at collection with a `FileNotFoundError`. I didn't look into that error.

I also made a stray empty `/tmp/x.py` by mistake and deleted it. Nothing is committed.

That notification is for the earlier background command I ran by mistake, and it was stopped at its time limit. That command had a stray `cat > /tmp/x.py` that waited on stdin and never finished. I don't need to restart it, because I re-ran the same checks without that line.

The fix and the regression test are already in place:
- Your example now re-parses to `{"c": {"d": 2}, "a": [{"x": 9}]}`.
- 360 tests pass, excluding `tests/test_toml_tests.py`, which errors at collection with a `FileNotFoundError`.

Nothing is committed.
