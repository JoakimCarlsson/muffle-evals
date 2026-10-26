Specifier import is missing in the tests, and some failures may predate my change. I'll fix the import and then compare against the base.

Tests import an installed copy, not `src`. I'll run them with `PYTHONPATH=src`.

`Requirement.__replace__` is added in `src/packaging/requirements.py`, so `copy.replace()` works on 3.13+ and you can call it directly on older versions. The full suite passes (62503 tests) when run with `PYTHONPATH=src`. Without that, pytest imports an older installed copy of `packaging`, and the new tests fail.

Your examples give the results you listed. I ran both, plus no-argument, unknown-keyword and invalid-value cases. The tests I added are in `tests/test_requirements.py`.

- **Arguments:** it takes only the keyword arguments `name`, `url`, `extras`, `specifier` and `marker`. Anything else raises `TypeError`. Fields you don't pass are kept, and the original is untouched. With no arguments you get an equal but distinct object.
- **Validation:** it rebuilds the requirement string and parses it again. It then checks that every field reads back exactly as given. That is why `name="foo[bar]"`, `extras={"a,b"}` and `url="a b"` raise `InvalidRequirement` instead of changing another field. Wrong types raise `InvalidRequirement` too, including a bare string passed as `extras`. An empty `url` also raises, since it would read back as `None`.
- **Normalization:** values are normalized as in parsing, so `Marker('extra == "Foo_Bar"')` becomes `extra == "foo-bar"`.
- **Specifiers:** the result gets a fresh `SpecifierSet` with fresh `Specifier` objects. The `prereleases` setting on the set and on each `Specifier` is kept.
- **Subclasses:** the result is built with `type(self)(string)`, so you get an instance of the subclass and its `__init__` runs. This assumes a subclass's `__init__` still accepts the requirement string.

I also made `_iter_parts` use a shared string-building helper, and added a changelog entry under unreleased. The `versionadded` note in the docstring says 26.4, which is my guess at the next release, so adjust it if that's wrong.

I haven't committed anything.
