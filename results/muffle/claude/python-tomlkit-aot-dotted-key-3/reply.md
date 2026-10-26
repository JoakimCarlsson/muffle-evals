Script ran outside the repo; rerun with the path set.

Your example now gives the output you expected: `c.d = 2` comes first, then `[[a]]` with `x = 9`. Parsing that output gives `{"c": {"d": 2}, "a": [{"x": 9}]}`.

The fix is in `_replace_at` in `tomlkit/container.py`. It already handled a dotted key being replaced by a non-super table (#524 and #513 in the code comments), but not by an array of tables. An array of tables always renders with a `[[header]]`, so I extended that check to cover it. The new `[[a]]` is now placed after the keys that render inline, so it no longer captures them.

I added a regression test, `test_replace_dotted_key_with_aot_does_not_capture_siblings`, in `tests/test_items.py`. The test suite passes (361 tests). I had to skip `tests/test_toml_tests.py` because it fails at collection with a `FileNotFoundError`.

I also tried three other layouts: a plain sibling key (`c = 2`), a following `[t]` table, and a preceding `x=1`. All of them parse back to the expected structure. In the `[t]` case there is no blank line between `x = 9` and `[t]`. That is only cosmetic and doesn't change what the document means.

I haven't committed anything.
