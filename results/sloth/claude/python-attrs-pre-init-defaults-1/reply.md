`__attrs_pre_init__` now gets the values you passed to `__init__`. The new test and the existing `tests/test_make.py` tests pass (263 passed, 1 skipped, 1 xfailed). I didn't run your exact snippet or the rest of the test suite.

The generated `__init__` built the pre-init call from the positional parameter list with the defaults still attached. Each call therefore passed the field's default expression instead of the argument you gave. The fix is in `src/attr/_make.py`, where the pre-init call now uses only the parameter names. Keyword-only fields already did this, which is why `val4` and `val5` were correct.

I added a regression test in `tests/test_make.py` covering a plain default and a factory. I also added a changelog entry at `changelog.d/+pre-init-defaults.change.md`. I didn't commit anything.

If you omit a factory field, `__attrs_pre_init__` still receives `NOTHING` for it. That is existing behaviour and I left it alone, since the factory only runs after the pre-init call.
