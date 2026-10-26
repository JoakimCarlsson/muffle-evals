The same 15 failures happen without my change. I'm adding tests for the new method next.

I added `Requirement.__replace__` in `src/packaging/requirements.py`. With `PYTHONPATH=src`, all 5358 tests in `tests/test_requirements.py` pass, including the new ones.

Plain `pytest` imports an installed `packaging` from the environment's site-packages, not `src`. That is why the 15 failures showed up before, with or without my change, and why the new tests failed at first.

- **Arguments:** it takes only the keyword arguments `name`, `url`, `extras`, `specifier` and `marker`. Any other keyword raises `TypeError`, and so does a value of the wrong type, such as a bare string for `extras`.
- **Result:** fields you don't pass are kept and the original is untouched. Calling it with no arguments gives an equal but distinct object.
- **Validation:** I build the requirement string from the new values and parse it. If the parsed name, url or extras differ from what you passed, it raises `InvalidRequirement`. That covers `name="foo[bar]"` and `extras={"a,b"}`, as well as `name="not a name!"`.
- **Marker:** it is normalized by that parse, so `extra == "Foo_Bar"` becomes `extra == "foo-bar"`.
- **Specifier:** the result gets a deep copy of the `SpecifierSet`, with new `Specifier` objects. The `prereleases` setting is kept on the set and on each `Specifier`.
- **Subclasses:** the result is built with `type(self)(requirement_string)`, so a subclass gets its own class and its own `__init__` setup. This assumes the subclass's `__init__` takes the requirement string, as `Requirement`'s does.

I also added an "unreleased" Features entry to `CHANGELOG.rst` and a `TestRequirementReplace` class to `tests/test_requirements.py`.

I checked your first example by hand and it gives `flask[security]>=2.0; python_version >= "3"`. I didn't run the `copy.replace()` example from your request. It calls `__replace__` the same way, so it should behave the same.

I put `versionadded:: 26.4` in the docstring as a guess at the next release number. Please correct it if that's wrong. Nothing is committed.
