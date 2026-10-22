`__attrs_pre_init__` now gets the values you passed for `val2` and `val3`. The new regression test passes. I didn't run your exact `Example` snippet; the test covers a positional default and a keyword-only one.

The generated `__init__` built the `__attrs_pre_init__` call from the positional parameters including their `=default` text. The call therefore evaluated those defaults instead of the passed values. Keyword-only attributes already had their defaults stripped, which is why `val4` and `val5` were correct.

The fix is in `src/attr/_make.py`, where the call arguments are built. It now strips the defaults from positional parameters too.

**Not passing a factory field:** if you leave out a `factory=` field, `__attrs_pre_init__` still receives `NOTHING` for it, because the factory only runs after the pre-init call. Keyword-only factory fields already behaved this way. I left that alone.

**Other changes:**
- I added a regression test, `TestPreInitPassedValues`, in `tests/test_make.py`.
- I added a changelog entry, `changelog.d/pre-init-defaults.change.md`.

**Test run:** the full suite shows 4 failures, all in `tests/test_packaging.py` (the version-metadata tests). They fail the same way without my change, so they aren't related.

I haven't committed anything.
