`__attrs_pre_init__` now receives the values you passed for positional attributes that have defaults. Your example now prints 200 for `val2` and `{"blah": "blah"}` for `val3`. I ran the init, slots and make tests (661 passed) and a new regression test for this. I didn't run the full test suite.

The generated `__init__` forwarded its own parameter list to `__attrs_pre_init__`, defaults included. Because of that, the call was `__attrs_pre_init__(val1, val2=<default>, ...)`, so the default was always used. The kw-only arguments already had their defaults stripped, which is why `val4` and `val5` worked. I applied the same stripping to the positional arguments in `src/attr/_make.py`.

If you omit an attribute that has a `factory`, `__attrs_pre_init__` still gets `NOTHING` for it. The factory only runs later, after pre-init. I left that as it is.

I added `test_pre_init_args_with_defaults` in `tests/test_make.py` and a changelog entry at `changelog.d/pre-init-defaults.change.md`. I didn't commit anything.
