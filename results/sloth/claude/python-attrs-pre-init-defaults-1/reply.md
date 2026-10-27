Fixed: `__attrs_pre_init__` now gets the values you passed to `__init__` for arguments with defaults. The full test suite passes (1341 passed, 5 skipped, 3 xfailed). I didn't run your exact example separately, but the new test covers the same two cases (a plain default and a `factory=`).

The bug was in `src/attr/_make.py`. The generated `__init__` built the `__attrs_pre_init__` call from its own parameter list, default expressions included. That meant a call like `__attrs_pre_init__(val2=<default>)` passed the default instead of your value. It now strips the defaults, as the keyword-only arguments already did.

I added a regression test, `test_pre_init_args_with_defaults`, in `tests/test_make.py`. I also added a changelog entry at `changelog.d/pre-init-defaults.change.md`.

Nothing is committed.
