The positional args keep their `=default` text. Strip it, as is already done for kw-only args.

Fixed: `__attrs_pre_init__` now receives the values you passed to `__init__` for positional fields that have defaults. The full test suite passes except one test, `test_packaging.py::test_version[attr]`. That test fails because attrs isn't installed as a package here, so it looks unrelated to my change.

**Cause:** in `_attrs_to_init_script` (`src/attr/_make.py`), the argument list for the `__attrs_pre_init__` call was built from the `__init__` signature, which includes the `=default` text. Python therefore evaluated the default in that call instead of using the argument you passed. Keyword-only arguments already had their defaults stripped, which is why `val4` and `val5` worked. I now strip them for positional arguments too.

I ran your example with `src` on the path. The first call now prints `200 200 {'b': 1} 200 200`.

When you don't pass a value, `__attrs_pre_init__` still gets the default, as before. For a `factory=` field that default is the `NOTHING` sentinel, because the factory only runs later in `__init__`. `Example(1, val4=4)` prints `1 100 _Nothing.NOTHING 4 100`.

I added a regression test, `test_pre_init_passes_given_values_over_defaults`, in `tests/test_make.py`. I also added a changelog entry, `changelog.d/pre-init-defaults.change.md`. I didn't commit anything.
