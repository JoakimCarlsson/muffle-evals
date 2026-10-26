Core behavior works; now adding tests and running the suite.

The failure is in my test, not the code. The set gets sorted when it's stringified, so I'm fixing the test's expected order.

`Requirement.__replace__` is added in `src/packaging/requirements.py`, and `copy.replace()` works with it on Python 3.13+. With `PYTHONPATH=src`, the full suite passes (62,506 tests). I didn't run the tests without it because the venv has an installed `packaging` that shadows `src`.

- **Arguments:** it takes keyword-only `name`, `url`, `extras`, `specifier` and `marker`. Any other keyword raises `TypeError`, and so does a positional argument.
- **Copying:** fields you don't pass are kept, and the original is untouched. With no arguments you get an equal but distinct object.
- **Validation:** it builds the string form, parses it, and then checks that every field came back as given. So `name="foo[bar]"`, `extras={"a,b"}` and a URL with a smuggled `; marker` raise `InvalidRequirement` instead of silently changing other fields. Wrong types raise it too, and so does a URL combined with a specifier. Values are normalized as in parsing, so `extra == "Foo_Bar"` becomes `extra == "foo-bar"`.
- **Prereleases:** the result gets a new `SpecifierSet` built from copies of the specifiers. The set's `prereleases` and each specifier's own setting are kept, and nothing is shared with the input.
- **Subclasses:** the new object is built with `self.__class__(string)`, so a subclass gets its own type and whatever its `__init__` sets up. This assumes a subclass `__init__` accepts a requirement string, as `Requirement`'s does.

`url=""` and `extras={""}` raise `InvalidRequirement`, because they can't be written in the string form and read back unchanged. Say if you'd rather `url=""` mean "no URL".

I also added tests in `tests/test_requirements.py`, a `CHANGELOG.rst` entry (marked 26.4 in the docstring's `versionadded`), and a `:special-members: __replace__` line in `docs/requirements.rst` so the method shows up in the docs. I haven't committed anything.
