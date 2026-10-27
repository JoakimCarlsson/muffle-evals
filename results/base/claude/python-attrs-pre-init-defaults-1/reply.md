`__attrs_pre_init__` now gets the values you passed for `val2` and `val3`, not their defaults. I haven't re-run your exact `Example` snippet; a new regression test covers the same cases.

The generated `__init__` built the pre-init call from the positional argument list, which still included the defaults (such as `val2=<default>`). Keyword-only arguments already had their defaults stripped, which is why `val4` and `val5` worked. I applied the same stripping to positional ones in `src/attr/_make.py`.

I added a regression test in `tests/test_make.py` (`test_pre_init_receives_passed_values_for_defaulted_args`). It covers a plain default, a factory default and a keyword-only default. I also added a changelog entry, `changelog.d/pre-init-defaults.change.md`.

The test suite passes (1335 passed) with `tests/test_packaging.py` deselected. One test in that file, `test_version[attr]`, failed in the first run. I didn't look into why, and I left that file out of the final run. `attr` wasn't importable at first, so I ran pytest with `PYTHONPATH=src`.

I haven't committed anything.
