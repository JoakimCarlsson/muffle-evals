Done. Fixed in `src/attr/_make.py`: positional args are now passed to `__attrs_pre_init__` by name only, not with their defaults. I added `changelog.d/pre-init-defaults.change.md`. Tests matching `-k init` pass (58), and I didn't run the full suite.

Fields with a `factory` still get `NOTHING` in `__attrs_pre_init__` when you don't pass them, because the factory runs after pre-init.
