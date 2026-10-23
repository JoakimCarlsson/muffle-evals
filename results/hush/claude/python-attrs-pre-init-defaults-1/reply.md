Done. Fixed in `src/attr/_make.py`: positional args now go to `__attrs_pre_init__` without their defaults, so passed values arrive. Changelog added at `changelog.d/+pre-init-defaults.change.md`. I ran only the `pre_init` and `init` tests, which pass. I added no regression test.

Omitted factory fields still reach `__attrs_pre_init__` as `NOTHING`.
