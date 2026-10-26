I've added `Requirement.__replace__`; the 15 failures in `tests/test_requirements.py` also occur without my change.

Next I'll add tests for the new method.

The source is fine. pytest is importing an installed copy of `packaging` instead of `src`. I'll rerun with `PYTHONPATH=src`.

`Requirement.__replace__` is added in `src/packaging/requirements.py`, and `copy.replace()` works with it on 3.13+.

With `PYTHONPATH=src`, all of `tests/test_requirements.py` passes, including 10 new tests for this method. Without `PYTHONPATH=src`, pytest imports an installed copy of `packaging` from the environment, and 15 tests in that file fail with or without my change.

- **Replacing fields:** it accepts only `name`, `url`, `extras`, `specifier` and `marker`. Any other keyword raises `TypeError`. Fields you don't pass are kept, and the original is untouched.
- **Validation:** it builds the requirement string and parses it again. It then checks that name, url, extras and specifier match what you passed, so `name="foo[bar]"`, `extras={"a,b"}` and `url="a b"` raise `InvalidRequirement`. Markers are normalized by parsing, so `extra == "Foo_Bar"` becomes `extra == "foo-bar"`.
- **Specifier copying:** the result gets a new `SpecifierSet` with new `Specifier` objects. The `prereleases` setting is kept on the set and on each specifier.
- **Subclasses:** the result is built with `self.__class__(string)`, so a subclass's own `__init__` runs. This assumes the subclass `__init__` takes the requirement string, as `Requirement`'s does.

I ran your examples and they give the expected output. I also added a changelog entry under unreleased.

I haven't committed anything.
