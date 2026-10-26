Running my test script imported an installed copy of packaging, not the source tree. I'll rerun it with `PYTHONPATH=src`.

`Requirement.__replace__` is added in `src/packaging/requirements.py`. `copy.replace()` works on 3.13+, and you can call `__replace__` directly on older versions. `tests/test_requirements.py` passes (5357 tests), including new tests for it. I haven't run the rest of the suite against the source tree, so the full suite is untested.

Your two examples and the `Foo_Bar` marker case give the output you listed.

- **Arguments:** it takes only `name`, `url`, `extras`, `specifier` and `marker`, as keywords. Any other keyword raises `TypeError`. So does a value of the wrong type, such as a string for `extras` or a non-`SpecifierSet` for `specifier`.
- **Validation:** it builds the new requirement's string and parses it back. If the parse fails or reads back differently, it raises `InvalidRequirement`. That covers `name="not a name!"`, `name="foo[bar]"`, `extras={"a,b"}` and a URL with a smuggled marker. Passing `""` as `url` is treated as `None`.
- **Normalization:** values are normalized as parsing would, so the marker `extra == "Foo_Bar"` ends up as `extra == "foo-bar"`.
- **Specifier sets:** the `SpecifierSet` and each of its `Specifier`s are copied with their `prereleases` settings, so nothing is shared with the input.
- **Subclasses:** the result is built by calling `self.__class__(string)`. A subclass gets its own type and whatever its `__init__` sets up, but its `__init__` must accept a single requirement string.
- **No arguments:** you get an equal requirement that is a different object.

I also added a changelog entry under unreleased, plus a `versionadded:: 26.3` note in the docstring. That version is a guess: the unreleased section is after 26.3, so you probably want to change it.

Running pytest without `PYTHONPATH=src` picked up an installed copy of `packaging` instead of the source tree. That caused a spurious failure in `tests/test_dependency_groups.py`. With `PYTHONPATH=src`, the dependency-groups tests pass.

I didn't commit anything.
