`__attrs_pre_init__` now gets the values you passed to `__init__` for positional attributes that have defaults. I haven't committed anything.

**Cause:** in `src/attr/_make.py`, the generated `__init__` built the `__attrs_pre_init__` call from the positional parameter list *including* their default expressions. So the call looked like `__attrs_pre_init__(val1, val2=<default>, ...)`. Python evaluated that as a keyword argument set to the default, which overrode what you passed. The keyword-only arguments already had their defaults stripped, which is why `val4` and `val5` worked.

**Fix:** the `__attrs_pre_init__` argument list now strips defaults from the positional arguments too (`src/attr/_make.py`, near line 2324). I also added a changelog entry, `changelog.d/pre-init-defaults.change.md`. It has no issue number in the filename, so rename it if your towncrier setup needs one.

**Checks:**
- Your example now prints `200 201 {'a': 1} 202 203` when I pass distinct values for each field.
- If you omit `val2` and `val3`, `__attrs_pre_init__` still gets the default (100) for `val2` and `_Nothing.NOTHING` for the factory field `val3`. The factory only runs later, in `__init__`, so I left that alone. That's separate from what you reported.
- The full test suite gives 4 failures, all in `tests/test_packaging.py` (`TestLegacyMetadataHack` version checks). The same 4 fail with my change stashed, so they aren't caused by it.
- I didn't add a regression test, since you didn't ask for one.
