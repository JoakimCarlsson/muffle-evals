Done. `__attrs_pre_init__` now gets the values passed to `__init__` for positional attributes with defaults. The fix is in `src/attr/_make.py`, and I added a changelog entry in `changelog.d/pre-init-defaults.change.md`.

I checked it with a trimmed version of your example (without `val4`/`val5`) and ran the `-k init` tests, which pass. I did not run the full test suite or add a regression test.

When you leave `val3` out, `__attrs_pre_init__` still receives `NOTHING` for it, since its factory only runs later inside `__init__`.
