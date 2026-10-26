Running my checks against `src/`. The earlier run seems to have imported an installed copy of `packaging`. I'll also check whether the 15 test failures were already there.

The implementation works. The earlier failures came from the installed copy of `packaging`, not `src/`. Next I'll add tests, docs and a changelog entry.

`Requirement.__replace__` is added, so `copy.replace()` works on Python 3.13+ and you can call `__replace__` directly on older versions. The tests in `tests/test_requirements.py` pass when run against `src/`. I didn't run the rest of the suite, and I haven't run a type checker or linter on the change.

Plain `pytest` without `PYTHONPATH=src` picked up an installed copy of `packaging` and gave false failures.

The change is in `src/packaging/requirements.py`, with new tests and a CHANGELOG entry:

- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`, and any other keyword raises `TypeError`. A string passed as `extras`, or the wrong type for `specifier` or `marker`, also raises `TypeError`.
- **Result:** fields you don't pass are kept and the original is untouched. With no arguments you get an equal but distinct object.
- **Validation:** the new requirement is built by parsing its string, so invalid values raise `InvalidRequirement`. After parsing I compare `name`, `url`, `extras` and the specifier with what you passed. That makes `name="foo[bar]"`, `extras={"a,b"}`, `url=""` and a URL containing a space raise instead of quietly changing other fields. Passing both a URL and a specifier also raises, as it does when parsing.
- **Markers:** values are normalized as in parsing, so `marker=Marker('extra == "Foo_Bar"')` ends up as `extra == "foo-bar"`.
- **Specifiers:** the result gets its own `SpecifierSet` and its own `Specifier` objects, whether you pass one or it is carried over. The `prereleases` setting is kept on the set and on each `Specifier`. I had to set the specifier back after parsing, because the string form drops those settings.
- **Subclasses:** the result is built with `type(self)(string)`, so a subclass gets its own class and whatever its `__init__` sets up. This assumes the subclass `__init__` still takes the requirement string as its one argument.

The CHANGELOG entry and the `versionadded:: 26.4` note in the docstring both assume the next release is 26.4, so adjust if it isn't. I didn't commit anything.
