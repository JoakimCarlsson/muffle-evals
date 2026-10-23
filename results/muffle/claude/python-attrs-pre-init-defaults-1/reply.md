`__attrs_pre_init__` now receives the values you passed for `val2` and `val3`. The test suite passes.

The generated `__init__` was calling `__attrs_pre_init__` with the positional parameters' default expressions (`val2=100`, `val3=NOTHING`) still attached. It only stripped the defaults from keyword-only ones, which is why `val4` and `val5` worked. The fix is in `src/attr/_make.py` and strips the defaults from the positional arguments too. I also added a changelog entry, `changelog.d/pre-init-defaults.change.md`. It has no issue number in the filename, so rename it if your towncrier setup needs one.

I checked it with a smaller version of your example, with `a`, `b`, `c` and a keyword-only `d`. Passing `E(1, 2, {"x": 1}, d=4)` gives `1 2 {'x': 1} 4`. I didn't add a regression test.

If you omit an argument that has a default, `__attrs_pre_init__` still doesn't see the default. A plain default arrives as `100`, but a `factory=` field arrives as `NOTHING`, because the factory only runs later. That matches how keyword-only fields already behaved.
