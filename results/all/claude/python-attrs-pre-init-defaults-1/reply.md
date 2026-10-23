Done. Positional defaults no longer leak into the `__attrs_pre_init__` call in `src/attr/_make.py`, so `val2` and `val3` now get the values you passed. I added a test and the changelog entry `changelog.d/+pre-init-defaults.change.md`. `tests/test_make.py` passes; I didn't run the rest of the suite.

When an argument isn't passed, a factory field (`val3`) still reaches `__attrs_pre_init__` as `NOTHING`, because the factory only runs after pre-init.
