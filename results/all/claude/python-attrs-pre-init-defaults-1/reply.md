Done. `src/attr/_make.py` now builds the `__attrs_pre_init__` call from positional argument names without their defaults. I also added `changelog.d/pre-init-defaults.change.md`.

- **Checks:** `1, 2, {'x': 1}, 3` now reaches `__attrs_pre_init__` in a small repro. The suite passes (1334) with `tests/test_packaging.py` deselected, because it fails here on package metadata, which I didn't look into. I added no regression test.
- **Risk:** a factory-default field you don't pass still arrives in `__attrs_pre_init__` as `NOTHING`.
