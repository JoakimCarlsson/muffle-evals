The implementation works. I'm now adding tests and a docs note, then I'll run the suite.

Pytest is importing an installed copy of `packaging`, not `src`. I'll point it at `src` instead.

`Requirement.__replace__` is added in `src/packaging/requirements.py`, so `copy.replace()` works on 3.13+ and you can call `__replace__` directly on older versions. The full `tests/test_requirements.py` passes (5369 tests) when run against `src`, and ruff and mypy are clean.

- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and any other keyword raises `TypeError`. Fields you don't pass are kept, and the original is untouched.
- **Validation:** it builds the requirement string, parses it and checks that name, url and extras come back as given. So `name="foo[bar]"`, `extras={"a,b"}` and `name="not a name!"` raise `InvalidRequirement`. A `url` combined with a specifier also raises, because PEP 508 doesn't allow that pair.
- **Normalization:** the marker comes from the parse, so `extra == "Foo_Bar"` becomes `extra == "foo-bar"`.
- **Specifiers:** the result gets a fresh `SpecifierSet` and fresh `Specifier`s. The `prereleases` settings on the set and on each specifier are kept, and nothing is shared with the input.
- **Subclasses:** the parse goes through `type(self)(string)`, so a subclass gets its own class back with its `__init__` run. This assumes a subclass `__init__` still takes the requirement string, as `Requirement`'s does.
- **Wrong types:** a wrong-typed value, such as `name=1` or `specifier=">=1"`, also raises `InvalidRequirement` rather than `TypeError`. You didn't specify this, so say if you'd rather have `TypeError`.

I added a `TestReplace` class to `tests/test_requirements.py` and an entry under "unreleased" in `CHANGELOG.rst`. I didn't edit the docs page, since the `automodule` on `docs/requirements.rst` should pick up the method's docstring.

Plain `pytest` imports an installed copy of `packaging` from the environment, not `src`, so it fails with "no attribute `__replace__`". Run it as `PYTHONPATH=src python -m pytest`. Against that installed copy, 15 tests in this file already failed before my change, such as `test_error_when_suffixed_with_line_break`.

Nothing is committed.
