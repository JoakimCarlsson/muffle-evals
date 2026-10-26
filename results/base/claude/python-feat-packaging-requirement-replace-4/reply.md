Version imports Self under TYPE_CHECKING; do the same.

`Requirement.__replace__` is added in `src/packaging/requirements.py`. `copy.replace()` works with it on Python 3.13+, and you can call it directly on older versions. With `PYTHONPATH=src`, `tests/test_requirements.py` passes (5360 tests).

The default `python -m pytest` picks up the `packaging` installed in your env, not `src`. That is why 15 tests fail there, even before my change. I ran the suite against `src` instead.

I checked your examples (`name="flask"`, `specifier=SpecifierSet(">=3.0")`, the `Foo_Bar` marker), the invalid inputs, and a subclass by hand. The seven new tests in `TestRequirementReplace` cover the same ground. I also added a changelog entry under unreleased.

How it behaves:
- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`. Any other keyword raises `TypeError`.
- **Unchanged fields:** fields you don't pass are kept. The result is always a new object, so with no arguments you get an equal but distinct copy.
- **Validation:** it builds the requirement string and parses it with the requirement's own class. It then checks that the parsed name, url and extras match what you passed in. That is what rejects `name="foo[bar]"`, `extras={"a,b"}` and `name="not a name!"` with `InvalidRequirement`.
- **Markers:** they are normalized by that parse, so the `Foo_Bar` marker comes out as `extra == "foo-bar"`.
- **Specifiers:** the `SpecifierSet` and each `Specifier` are rebuilt as new objects, keeping their `prereleases` settings, so nothing is shared with the input.
- **Subclasses:** you get an instance of the subclass, with its own `__init__` run.

Choices I made where your request didn't say:
- **URL with a specifier:** replacing `url` on a requirement that has a specifier raises `InvalidRequirement`, because PEP 508 doesn't allow both. You need `specifier=SpecifierSet()` as well.
- **Empty URL:** `url=""` also raises, because it would read back as `None`.
- **Wrong types:** passing a plain string as `extras` raises `TypeError`. Other wrong types, such as a string for `specifier`, raise `InvalidRequirement`.
- **Version number:** the docstring and changelog say "versionadded 26.4", guessed from the existing `Version.__replace__` notes. Adjust it if that's wrong.

I didn't commit anything.
