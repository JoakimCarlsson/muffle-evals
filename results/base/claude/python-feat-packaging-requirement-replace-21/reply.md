Adding `__replace__` to `Requirement` now. First I'm checking how `direct_url.py` imports `Self`, so I can match it.

Tests import an installed copy; run with `PYTHONPATH=src`.

Duplicate import (it was already there); remove one.

`Requirement.__replace__` is added in `src/packaging/requirements.py`, and `copy.replace()` works with it. The tests in `tests/test_requirements.py` pass when run against `src`. I didn't run the rest of the suite or any linting or type checks, and nothing is committed.

Both of your examples give the output you showed. The checks I ran cover the rest of what you listed:

- **Unknown keyword:** any keyword other than the five fields raises `TypeError`.
- **Copy semantics:** the original is untouched. A no-argument call gives an equal but distinct object.
- **Validation:** `name="not a name!"`, `name="foo[bar]"` and `extras={"a,b"}` raise `InvalidRequirement`. The method builds the requirement string, parses it, and rejects the result if the parsed name, URL, extras or marker differ from what you passed.
- **Normalization:** `marker=Marker('extra == "Foo_Bar"')` ends up as `extra == "foo-bar"`.
- **`SpecifierSet`:** the result gets a new set and new `Specifier` objects. The `prereleases` settings on the set and on each `Specifier` are kept, and nothing is shared with the input.
- **Subclasses:** the result is built by calling `type(self)(string)`. A subclass gets back its own class with whatever its `__init__` sets up. This assumes the subclass's `__init__` accepts a requirement string, as `Requirement`'s does.

- **Type errors:** a value of the wrong type, such as a `str` for `specifier`, raises `InvalidRequirement` rather than `TypeError`.
- **Empty URL:** `url=""` is treated as `None`, the same as parsing.
- **Version tag:** the docstring says `versionadded:: 26.4`, which is my guess. Change it if the release number is different.

I also added a `CHANGELOG.rst` entry and a `TestRequirementReplace` class in the tests.

Plain `pytest` in this environment imports an installed `packaging` copy that predates this change. Use `PYTHONPATH=src` to test the working tree.
